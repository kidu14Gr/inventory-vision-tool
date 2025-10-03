import os
from typing import List, Optional
from fastapi import FastAPI, HTTPException
import pandas as pd
from datetime import datetime, timedelta
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
import logging
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = "/app/data"
INVENTORY_FILE = os.path.join(DATA_DIR, "combined_all.csv")
REQUESTS_FILE = os.path.join(DATA_DIR, "combined_requested.csv")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

app = FastAPI(title="SCM API", version="1.1")

# Allow frontend to call this API (adjust origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv('VITE_API_BASE', '*')],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- Data loading functions ----------------

def load_inventory_data():
    try:
        df = pd.read_csv(INVENTORY_FILE)
        logger.info(f"Loaded inventory data with {len(df)} rows")
        return df
    except Exception as e:
        logger.error(f"Error loading inventory data: {e}")
        return pd.DataFrame()

def load_requests_data():
    try:
        df = pd.read_csv(REQUESTS_FILE)
        logger.info(f"Loaded requests data with {len(df)} rows")
        return df
    except Exception as e:
        logger.error(f"Error loading requests data: {e}")
        return pd.DataFrame()







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
    df = load_requests_data()
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
    df = load_inventory_data()
    if df.empty:
        return []
    # Assume columns: item_name, quantity, amount, department_id or similar
    df = ensure_column(df, "quantity")
    df = ensure_column(df, "amount")
    if "department_id" in df.columns:
        df["project_display"] = df["department_id"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = "All Projects"
    if project != "All Projects":
        df = df[df["project_display"] == project]
    # Aggregate by item
    agg_df = df.groupby("item_name").agg({
        'quantity': 'sum',
        'amount': 'sum'
    }).reset_index()
    status_field = 'amount' if view == "Amount" else 'quantity'
    def stock_status(row):
        if row[status_field] <= 5:
            return "Critical"
        elif row[status_field] <= 20:
            return "Low Stock"
        else:
            return "Sufficient"
    agg_df['Status'] = agg_df.apply(stock_status, axis=1)
    return agg_df.to_dict(orient="records")

# ---------------- Requests endpoint ----------------
@app.get("/requests")
def get_requests(project: str = "All Projects"):
    df = load_requests_data()
    if df.empty:
        return []
    # Assume columns: item_name, requested_quantity, requested_date, requested_project_name
    if "requested_project_name" in df.columns:
        df["project_display"] = df["requested_project_name"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = "All Projects"
    if project != "All Projects":
        df = df[df["project_display"] == project]
    return df.to_dict(orient="records")

# ---------------- Transaction aggregation ----------------
@app.get("/transactions")
def get_transactions(project: str = "All Projects"):
    df = load_requests_data()  # Assuming transactions from requests data
    if df.empty:
        return []
    if "requested_project_name" in df.columns:
        df["project_display"] = df["requested_project_name"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = "All Projects"
    if project != "All Projects":
        df = df[df["project_display"] == project]
    # Aggregate for transactions
    agg_df = df.groupby("item_name").agg({
        'requested_quantity': 'sum',
        'consumed_amount': 'sum',
        'returned_quantity': 'sum'
    }).reset_index()
    return agg_df.to_dict(orient="records")

@app.get("/demand")
def get_demand(project: str = "All Projects", weeks: int = 4):
    df = load_requests_data()
    if df.empty:
        return []
    if "requested_project_name" in df.columns:
        df["project_display"] = df["requested_project_name"].fillna("").astype(str).str.strip()
    else:
        df["project_display"] = "All Projects"
    if project != "All Projects":
        df = df[df["project_display"] == project]
    if "requested_date" not in df.columns or "item_name" not in df.columns or "requested_quantity" not in df.columns:
        return []
    df["requested_date"] = pd.to_datetime(df["requested_date"], errors="coerce")
    df = df.dropna(subset=["requested_date"])
    # Calculate average weekly demand per item
    df["week"] = df["requested_date"].dt.to_period("W")
    weekly_demand = df.groupby(["item_name", "week"])["requested_quantity"].sum().reset_index()
    avg_demand = weekly_demand.groupby("item_name")["requested_quantity"].mean().reset_index()
    avg_demand.rename(columns={"requested_quantity": "avg_weekly_demand"}, inplace=True)
    # Predict for next weeks
    predictions = []
    start_date = datetime.now()
    for _, row in avg_demand.iterrows():
        item = row["item_name"]
        avg = row["avg_weekly_demand"]
        for i in range(1, weeks + 1):
            pred_date = start_date + timedelta(weeks=i)
            predictions.append({
                "item_name": item,
                "predicted_date": pred_date.strftime("%Y-%m-%d"),
                "predicted_quantity": round(avg, 2)
            })
    return predictions
