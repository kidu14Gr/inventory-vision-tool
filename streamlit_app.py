#!/usr/bin/env python
import os
import json
import time
import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime, timedelta
import logging
import requests
from google import genai

# -------------------------- Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -------------------------- Determine Docker environment
def running_in_docker():
    return os.path.exists('/.dockerenv')

# -------------------------- Kafka API URL
if running_in_docker():
    KAFKA_API_URL = os.getenv("KAFKA_API_URL", "http://scm_kafka-api:5000")
else:
    KAFKA_API_URL = os.getenv("KAFKA_API_URL", "http://localhost:5000")

TOPIC_REQUESTS = "scm_requests"
TOPIC_INVENTORY = "scm_inventory"
MAX_MESSAGES = 5000

# -------------------------- Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

# -------------------------- Helper Functions
def get_recent_data(df, months=3):
    if df.empty or 'requested_date' not in df.columns:
        return pd.DataFrame()
    df['requested_date'] = pd.to_datetime(df['requested_date'], errors='coerce')
    cutoff = datetime.now() - timedelta(days=30*months)
    return df[df['requested_date'] >= cutoff]

def filter_by_timeframe(df, user_question):
    if df.empty or 'requested_date' not in df.columns:
        return pd.DataFrame(), "No data"
    df['requested_date'] = pd.to_datetime(df['requested_date'], errors='coerce')
    today = datetime.now().date()

    if "last week" in user_question.lower():
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
        return df[(df['requested_date'].dt.date >= start) & (df['requested_date'].dt.date <= end)], f"{start} to {end}"

    elif "last month" in user_question.lower():
        first_day_this_month = today.replace(day=1)
        last_day_last_month = first_day_this_month - timedelta(days=1)
        first_day_last_month = last_day_last_month.replace(day=1)
        return df[(df['requested_date'].dt.date >= first_day_last_month) & (df['requested_date'].dt.date <= last_day_last_month)], f"{first_day_last_month} to {last_day_last_month}"

    else:
        cutoff = today - timedelta(days=90)
        return df[df['requested_date'].dt.date >= cutoff], "last 3 months"

def get_recent_items(df, project=None, months_list=[3,6,9,12], min_items=1):
    for months in months_list:
        cutoff = datetime.now() - timedelta(days=30*months)
        recent_df = df[df['requested_date'] >= cutoff]
        if project:
            recent_df = recent_df[recent_df['project_display'] == project]
        items = recent_df['item_name'].dropna().value_counts().index.tolist()
        if len(items) >= min_items:
            return items, months
    items = df['item_name'].dropna().value_counts().index.tolist()
    return items, months_list[-1]

def ask_chatbot(user_question, requests_df, client=None):
    if not user_question.strip():
        return "Please ask a valid question."

    forecast_keywords = ["next week", "next month", "forecast", "predict"]
    is_forecast = any(k in user_question.lower() for k in forecast_keywords)

    project_name = None
    for word in user_question.split():
        if word.upper() in requests_df['project_display'].unique():
            project_name = word.upper()
            break

    if is_forecast:
        items, months_used = get_recent_items(requests_df, project_name)
        if not items:
            return "Insufficient historical data to forecast demand."
        if project_name:
            return (f"Based on historical data from the past {months_used} months, "
                    f"the project '{project_name}' is likely to need the following items next week: "
                    f"{', '.join(items[:5])}.")
        else:
            return (f"Based on historical data from the past {months_used} months, "
                    f"the project is likely to need the following items next week: "
                    f"{', '.join(items[:5])}.")

    period_df, analysis_window = filter_by_timeframe(requests_df, user_question)
    if period_df.empty:
        return f"No data available for the requested period ({analysis_window})."

    total_requested = period_df['requested_quantity'].sum()
    avg_qty = period_df['requested_quantity'].mean()
    top_items = period_df['item_name'].value_counts().head(5)

    cutoff_prev = datetime.now() - timedelta(days=90)
    prev_df = requests_df[(requests_df['requested_date'] >= cutoff_prev) & 
                          (requests_df['requested_date'] < period_df['requested_date'].min())]
    prev_total = prev_df['requested_quantity'].sum() if not prev_df.empty else 0
    trend = "increase" if total_requested > prev_total else "decrease" if total_requested < prev_total else "stable"

    if client:
        try:
            prompt = f"""
**Role:** You are a Senior Inventory Strategist.
**Objective:** Transform the following raw inventory request data for '{analysis_window}' into concise, executive-level analysis.
**Data for Analysis:**
{period_df[['project_display','item_name','requested_quantity']].to_csv(index=False)}
**User's Question:** "{user_question}"
"""
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini API failed: {e}, falling back to local insight.")

    insight_text = (
        f"**Executive Analysis ({analysis_window})**\n\n"
        f"**Headline Summary:** The period showed a {trend} in inventory requests, with key items {', '.join(top_items.index[:3])}.\n\n"
        f"**Key Drivers & Context:** High-demand items included {', '.join(top_items.index[:3])}. Demand mainly from projects {', '.join(period_df['project_display'].unique()[:2])}.\n\n"
        f"**Trend & Business Impact:** Overall usage {trend}.\n\n"
        f"**Actionable Recommendations:** Verify stock for critical items, prioritize high-demand equipment, monitor spikes to prevent disruption."
    )
    return insight_text

def fetch_from_kafka_api(topic, group_id, limit=MAX_MESSAGES, auto_offset_reset='latest'):
    max_retries = 3
    backoff = 1
    for attempt in range(1, max_retries + 1):
        try:
            payload = {
                "topic": topic,
                "group_id": group_id,
                "limit": int(limit),
                "auto_offset_reset": auto_offset_reset,
            }
            resp = requests.post(f"{KAFKA_API_URL.rstrip('/')}/consume", json=payload, timeout=15)
            resp.raise_for_status()
            body = resp.json()
            msgs = body.get('messages', []) if isinstance(body, dict) else []
            values = []
            for m in msgs:
                v = m.get('value')
                if isinstance(v, str):
                    try:
                        v = json.loads(v)
                    except Exception:
                        v = {"raw_value": v}
                values.append(v)
            return values
        except Exception as e:
            logger.warning(f"Attempt {attempt}/{max_retries} - Kafka API fetch failed ({KAFKA_API_URL}): {e}")
            if attempt == max_retries:
                return None
            time.sleep(backoff)
            backoff *= 2

def aggregate_transactions(df, period='W'):
    if df.empty:
        return pd.DataFrame()
    if 'requested_date' not in df.columns:
        df['requested_date'] = datetime.now()
    df['requested_date'] = pd.to_datetime(df['requested_date'], errors='coerce')
    df = df.set_index('requested_date')
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
        return pd.DataFrame(), {}
    for col in ['item_name','price','date_of_purchased','store_store_name','quantity','amount']:
        if col not in df.columns:
            df[col] = 0
    agg_df = df.groupby(['item_name','price','date_of_purchased','store_store_name'], as_index=False).agg({'amount':'sum','quantity':'first'})
    status_field = 'amount' if view_option=="Amount" else 'quantity'
    def stock_status(row):
        if row[status_field] <= 5:
            return "🔴 Critical"
        elif row[status_field] <= 20:
            return "🟡 Low Stock"
        else:
            return "🟢 Sufficient"
    agg_df['Status'] = agg_df.apply(stock_status, axis=1)
    summary = {
        "Critical": (agg_df['Status'] == "🔴 Critical").sum(),
        "Low Stock": (agg_df['Status'] == "🟡 Low Stock").sum(),
        "Sufficient": (agg_df['Status'] == "🟢 Sufficient").sum(),
        "Total Items": len(agg_df),
        "Total Price (Birr)": agg_df['amount'].sum()
    }
    return agg_df, summary

def generate_unreturned_item_alert(requests_df, selected_project):
    if requests_df.empty or selected_project == "All Projects":
        return "Select a specific project to view unreturned items."
    project_requests = requests_df[requests_df['project_display'] == selected_project].copy()
    if project_requests.empty:
        return f"No request data for project {selected_project}."
    project_requests['returned_quantity'] = project_requests.get('returned_quantity', 0).fillna(0)
    project_requests['current_consumed_amount'] = project_requests.get('current_consumed_amount', 0).fillna(0)
    unreturned_requests = project_requests[(project_requests['returned_quantity'] == 0) & 
                                           (project_requests['current_consumed_amount'] == 0)]
    if unreturned_requests.empty:
        return f"No unreturned or unconsumed items for project {selected_project}."
    unreturned_requests['requested_date'] = pd.to_datetime(unreturned_requests.get('requested_date', pd.Timestamp.now()), errors='coerce')
    unreturned_requests['requester_received_date'] = pd.to_datetime(unreturned_requests.get('requester_received_date', pd.Timestamp.now()), errors='coerce')
    unreturned_requests['relevant_date'] = unreturned_requests['requester_received_date'].fillna(unreturned_requests['requested_date'])
    oldest_request = unreturned_requests.loc[unreturned_requests['relevant_date'].idxmin()]
    requester = oldest_request.get('requester_name', 'Unknown Requester')
    item = oldest_request.get('item_name', 'Unknown Item')
    project = oldest_request.get('project_display', 'Unknown Project')
    date = oldest_request['relevant_date'].strftime('%Y-%m-%d')
    days_held = (datetime.now() - oldest_request['relevant_date']).days
    return f"⚠️ Longest unreturned/unconsumed item:\n- {requester} (Project: {project}) requested {item} on {date} ({days_held} days ago)"

# -------------------------- Streamlit App
st.set_page_config(page_title="SCM Real-Time Dashboard", page_icon="📊", layout="wide")
ML_API_URL = os.getenv("ML_API_URL", "http://scm_ml-api:8001")

def call_prediction_api(project_name, item_name):
    try:
        payload = {
            "project_name": project_name,
            "item_name": item_name,
            "requested_date": datetime.now().strftime("%Y-%m-%d"),
            "in_use": 1
        }
        response = requests.post(f"{ML_API_URL}/predict", json=payload, timeout=10)
        if response.status_code == 200:
            return response.json().get("predicted_quantity", None)
        else:
            st.error(f"Prediction API error: {response.text}")
            return None
    except Exception as e:
        st.error(f"Failed to call ML API: {e}")
        return None

def main():
    st.markdown("""
        <div style="background-color:#16a34a;color:white;padding:1rem;border-radius:0.5rem;margin-bottom:1rem;">
            <h1 style="margin:0;">📦 SCM Real-Time Dashboard</h1>
            <p style="margin:0;">Monitor inventory and transactions across projects</p>
        </div>
    """, unsafe_allow_html=True)

    if "requests_data" not in st.session_state:
        st.session_state.requests_data = []
    if "inventory_data" not in st.session_state:
        st.session_state.inventory_data = []

    # Fetch messages from Kafka API only
    api_requests = fetch_from_kafka_api(
      TOPIC_REQUESTS,
      group_id=f"scm_streamlit_requests_{int(time.time())}",
      limit=MAX_MESSAGES,
      auto_offset_reset='earliest'
    )

    api_inventory = fetch_from_kafka_api(
      TOPIC_INVENTORY,
      group_id=f"scm_streamlit_inventory_{int(time.time())}",
      limit=MAX_MESSAGES,
      auto_offset_reset='earliest'
    )

    if api_requests is not None and api_requests:
        st.session_state.requests_data = api_requests
    else:
        st.error(f"❌ Failed to fetch requests data from Kafka API at {KAFKA_API_URL}")

    if api_inventory is not None and api_inventory:
        st.session_state.inventory_data = api_inventory
    else:
        st.error(f"❌ Failed to fetch inventory data from Kafka API at {KAFKA_API_URL}")

    requests_df = pd.DataFrame(st.session_state.requests_data)
    inventory_df = pd.DataFrame(st.session_state.inventory_data)

    # Standardize project names
    requests_df['project_display'] = requests_df.get('requested_project_name', '').fillna('').astype(str).str.strip()
    inventory_df['project_display'] = inventory_df.get('department_id', '').fillna('').astype(str).str.strip()

    new_fields = ['returned_date', 'is_requester_received', 'requester_received_date',
                  'current_consumed_amount', 'consumed_amount', 'is_approved', 'approved_date']
    for col in new_fields:
        requests_df = ensure_column(requests_df, col)
        inventory_df = ensure_column(inventory_df, col)

    with st.sidebar:
        st.markdown("## Project Filters")
        selected_project_inventory = st.selectbox(
            "Inventory Project",
            ["All Projects"] + sorted(inventory_df['project_display'].unique().tolist())
        )
        selected_project_usage = st.selectbox(
            "Usage Project",
            ["All Projects"] + sorted(requests_df['project_display'].unique().tolist())
        )

    col_left, col_right = st.columns(2)

    with col_left:
        st.subheader("Inventory Analysis")
        view_option = st.selectbox("View Stock By:", ["Quantity", "Amount"], key="inventory_view")
        inventory_filtered = inventory_df if selected_project_inventory == "All Projects" else inventory_df[inventory_df['project_display'] == selected_project_inventory]
        inventory_display, summary = prepare_inventory_display(inventory_filtered, view_option)
        if not inventory_display.empty:
            st.markdown(f"""
              **📊 Inventory Summary ({selected_project_inventory})**
              - 🔴 Critical Items: **{summary['Critical']}**
              - 🟡 Low Stock Items: **{summary['Low Stock']}**
              - 🟢 Sufficient Items: **{summary['Sufficient']}**
              - 📦 Total Items: **{summary['Total Items']}**
              - 💰 Total Price: **{summary['Total Price (Birr)']:,.2f} birr**
            """)
            st.dataframe(inventory_display)
        else:
            st.info("No inventory data available.")

    with col_right:
        st.subheader("Usage Analytics")
        requests_filtered = requests_df if selected_project_usage == "All Projects" else requests_df[requests_df['project_display'] == selected_project_usage]
        trans_agg = aggregate_transactions(requests_filtered)
        if not trans_agg.empty:
            pie_fig = px.pie(
                trans_agg.melt(value_vars=['requested_quantity','current_consumed_amount','returned_quantity'],
                               var_name='Transaction', value_name='Count'),
                names='Transaction', values='Count'
            )
            st.plotly_chart(pie_fig, use_container_width=True)
        else:
            st.info("No transaction data available.")

        alert_msg = generate_unreturned_item_alert(requests_df, selected_project_usage)
        if alert_msg.startswith("⚠️"):
            st.error(alert_msg)
        else:
            st.success(alert_msg)

        st.subheader("🔮 Demand Prediction")
        available_projects = sorted(requests_df['project_display'].dropna().unique().tolist())
        project_choice = st.selectbox("Select Project", available_projects if available_projects else ["No projects available"], key="predict_project")

        if project_choice and project_choice != "No projects available":
            project_items = requests_df[requests_df['project_display'] == project_choice]['item_name'].dropna().unique().tolist()
            available_items = sorted(project_items)
        else:
            available_items = []

        item_choice = st.selectbox("Select Item", available_items if available_items else ["No items available"], key="predict_item")

        if st.button("Predict Next Week Demand"):
            if project_choice not in ["", "No projects available"] and item_choice not in ["", "No items available"]:
                prediction = call_prediction_api(project_choice, item_choice)
                if prediction is not None:
                    st.info(f"📈 Predicted next week quantity for {item_choice} (Project: {project_choice}): **{prediction:.2f}**")
            else:
                st.warning("Select both project and item for prediction.")

    st.subheader("💬 Ask SCM Chatbot")
    user_question = st.text_area("Enter your question about inventory or forecast:")
    if st.button("Ask Chatbot"):
        response = ask_chatbot(user_question, requests_df, client=client)
        st.markdown(f"**Response:**\n{response}")

if __name__ == "__main__":
    main()
