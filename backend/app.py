import os
import json
import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from kafka import KafkaConsumer
import pandas as pd
from datetime import datetime
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
import logging
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:9092")
TOPIC_REQUESTS = "scm_requests"
TOPIC_INVENTORY = "scm_inventory"
MAX_MESSAGES = 5000
ML_API_URL = os.getenv("ML_API_URL", "http://scm_ml-api:8001")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="SCM Kafka API", version="1.1")

# Allow frontend to call this API (adjust origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv('VITE_API_BASE', '*')],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Kafka consumer cache ----------------
consumers = {}

def get_consumer(topic):
    if topic not in consumers:
        consumers[topic] = KafkaConsumer(
            topic,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS.split(","),
            value_deserializer=lambda x: json.loads(x.decode('utf-8')),
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            group_id=f"fastapi_{topic}_{int(time.time())}"
        )
    return consumers[topic]

def fetch_data(topic, batch_size=1000):
    consumer = get_consumer(topic)
    messages = consumer.poll(timeout_ms=2000, max_records=batch_size)
    data = []
    for _, msgs in messages.items():
        for msg in msgs:
            data.append(msg.value)
    return data


# ---------------- Prediction models / ML API wrapper
class PredictRequest(BaseModel):
    project_name: str
    item_name: str
    requested_date: Optional[str] = None
    in_use: Optional[int] = 1


@app.post("/predict")
def predict(req: PredictRequest):
    """Proxy to ML API if available, otherwise fall back to a simple heuristic using Kafka history."""
    payload = req.dict()
    try:
        # Try calling external ML API
        resp = requests.post(f"{ML_API_URL}/predict", json=payload, timeout=10)
        if resp.status_code == 200:
            return resp.json()
        else:
            logger.warning(f"ML API returned {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.warning(f"Failed to call ML API: {e}")

    # Fallback: simple heuristic based on recent average of requested_quantity
    data = fetch_data(TOPIC_REQUESTS, batch_size=MAX_MESSAGES)
    df = pd.DataFrame(data)
    if df.empty:
        return {"predicted_quantity": None, "reason": "no_data"}
    if "requested_project_name" in df.columns:
        df["project_display"] = df["requested_project_name"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = df.get("project_display", "")

    try:
        df["requested_date"] = pd.to_datetime(df.get("requested_date", None), errors="coerce")
        cutoff = datetime.now() - pd.Timedelta(days=30)
        recent = df[(df["project_display"] == req.project_name) & (df["requested_date"] >= cutoff)]
        if recent.empty:
            recent = df[df["project_display"] == req.project_name]
        if recent.empty:
            # global fallback
            recent = df
        avg = recent.get("requested_quantity", pd.Series(dtype=float)).astype(float).mean()
        predicted = float(avg) if not pd.isna(avg) else None
        return {"predicted_quantity": predicted, "reason": "heuristic_fallback"}
    except Exception as e:
        logger.error(f"Prediction fallback failed: {e}")
        return {"predicted_quantity": None, "reason": "error"}


# ---------------- Chat (Gemini) endpoint
class ChatRequest(BaseModel):
    question: str
    project: Optional[str] = None


@app.post("/chat")
def chat_endpoint(req: ChatRequest):
    """Attempt to call Gemini (via google-genai) if configured; otherwise return a local analysis summary."""
    question = req.question or ""
    if GEMINI_API_KEY:
        try:
            # Use REST call to google genai if python client not available in server env
            headers = {"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"}
            prompt = question
            body = {"model": "gemini-1.5-flash", "prompt": prompt}
            # Note: this REST shape may change depending on the genai API - keep simple
            resp = requests.post("https://api.generative.googleapis.com/v1beta2/models:generateText", headers=headers, json=body, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.warning(f"Gemini REST call failed {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Gemini call failed: {e}")

    # Local fallback: simple canned reply or short analysis
    # For a better reply, we can fetch recent requests and run the same local analysis
    data = fetch_data(TOPIC_REQUESTS, batch_size=MAX_MESSAGES)
    df = pd.DataFrame(data)
    if not df.empty:
        # simple insight: top items
        top = df.get("item_name", pd.Series()).value_counts().head(5).to_dict()
        return {"answer": f"Top items in recent data: {top}. (local fallback)"}

    return {"answer": "No data available and Gemini not configured."}

# ---------------- Aggregation helper ----------------
def aggregate_transactions(df, period="W"):
    if df.empty:
        return pd.DataFrame()
    if "requested_date" not in df.columns:
        df["requested_date"] = datetime.now()
    df["requested_date"] = pd.to_datetime(df["requested_date"], errors="coerce")
    df = df.set_index("requested_date")
    for col in ['requested_quantity','current_consumed_amount','consumed_amount','returned_quantity','amount']:
        if col not in df.columns:
            df[col] = 0
    agg = df.resample(period).agg({
        'requested_quantity': 'sum',
        'current_consumed_amount': 'sum',
        'consumed_amount': 'sum',
        'returned_quantity': 'sum',
        'amount': 'sum'
    }).reset_index()
    return agg

def ensure_column(df, col):
    if col not in df.columns:
        df[col] = None
    return df

def prepare_inventory_display(df, view_option="Quantity"):
    if df.empty:
        return pd.DataFrame()
    for col in ['item_name','price','date_of_purchased','store_store_name','quantity','amount']:
        if col not in df.columns:
            df[col] = 0
    agg_df = df.groupby(['item_name','price','date_of_purchased','store_store_name'], as_index=False).agg({
        'amount':'sum',
        'quantity':'first'
    })
    status_field = 'amount' if view_option=="Amount" else 'quantity'
    def stock_status(row):
        if row[status_field] <= 5:
            return "Critical"
        elif row[status_field] <= 20:
            return "Low"
        else:
            return "Sufficient"
    agg_df['Status'] = agg_df.apply(stock_status, axis=1)
    return agg_df

# ---------------- Healthcheck ----------------
@app.get("/health")
def health():
    return {"status": "ok"}

# ---------------- Inventory endpoint ----------------
@app.get("/inventory")
def get_inventory(project: str = "All Projects", view: str = "Quantity"):
    data = fetch_data(TOPIC_INVENTORY, MAX_MESSAGES)
    df = pd.DataFrame(data)
    if "department_id" in df.columns:
        df["project_display"] = df["department_id"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = df.get("project_display", "")
    df = ensure_column(df, "quantity")
    df = ensure_column(df, "amount")
    if project != "All Projects":
        df = df[df["project_display"]==project]
    display_df = prepare_inventory_display(df, view)
    return display_df.to_dict(orient="records")

# ---------------- Requests endpoint ----------------
@app.get("/requests")
def get_requests(project: str = "All Projects"):
    data = fetch_data(TOPIC_REQUESTS, MAX_MESSAGES)
    df = pd.DataFrame(data)
    if "requested_project_name" in df.columns:
        df["project_display"] = df["requested_project_name"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = df.get("project_display", "")
    if project != "All Projects":
        df = df[df["project_display"]==project]
    return df.to_dict(orient="records")

# ---------------- Transaction aggregation ----------------
@app.get("/transactions")
def get_transactions(project: str = "All Projects"):
    requests_data = fetch_data(TOPIC_REQUESTS, MAX_MESSAGES)
    df = pd.DataFrame(requests_data)
    if "requested_project_name" in df.columns:
        df["project_display"] = df["requested_project_name"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = df.get("project_display", "")
    if project != "All Projects":
        df = df[df["project_display"]==project]
    agg_df = aggregate_transactions(df)
    return agg_df.to_dict(orient="records")
