from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import random
from datetime import datetime, timedelta

app = FastAPI(title="SCM Kafka API Mock")

class ConsumeRequest(BaseModel):
    topic: str
    group_id: str
    auto_offset_reset: str
    limit: int

class Message(BaseModel):
    value: Dict[str, Any]

class ConsumeResponse(BaseModel):
    count: int
    messages: List[Message]

# Mock data generators
def generate_inventory_data(limit: int) -> List[Dict[str, Any]]:
    items = [
        {"item_name": "Steel Pipe 2\"", "quantity": random.randint(50, 200), "store": "Main Warehouse", "category": "Pipes"},
        {"item_name": "Copper Wire 10mm", "quantity": random.randint(100, 500), "store": "Electrical Store", "category": "Electrical"},
        {"item_name": "Concrete Mix", "quantity": random.randint(20, 100), "store": "Construction Yard", "category": "Materials"},
        {"item_name": "Paint White 5L", "quantity": random.randint(30, 150), "store": "Paint Shop", "category": "Finishing"},
        {"item_name": "Nails 50mm", "quantity": random.randint(200, 1000), "store": "Hardware Store", "category": "Hardware"},
        {"item_name": "PVC Pipe 4\"", "quantity": random.randint(40, 180), "store": "Plumbing Store", "category": "Pipes"},
        {"item_name": "LED Bulbs 10W", "quantity": random.randint(80, 300), "store": "Electrical Store", "category": "Electrical"},
        {"item_name": "Sand Bags", "quantity": random.randint(15, 75), "store": "Construction Yard", "category": "Materials"},
        {"item_name": "Tile Adhesive", "quantity": random.randint(25, 120), "store": "Tile Store", "category": "Finishing"},
        {"item_name": "Screws 25mm", "quantity": random.randint(150, 800), "store": "Hardware Store", "category": "Hardware"}
    ]

    # Return up to limit items, with some randomness
    num_items = min(limit, len(items))
    selected_items = random.sample(items, num_items)
    return selected_items

def generate_requests_data(limit: int) -> List[Dict[str, Any]]:
    projects = ["BUILD001", "INFRA2024", "MAINTENANCE", "NEWCONSTR", "UPGRADE"]
    items = ["Steel Pipe 2\"", "Copper Wire 10mm", "Concrete Mix", "Paint White 5L", "Nails 50mm", "PVC Pipe 4\"", "LED Bulbs 10W", "Sand Bags", "Tile Adhesive", "Screws 25mm"]

    requests = []
    base_date = datetime.now() - timedelta(days=30)

    for i in range(limit):
        request_date = base_date + timedelta(days=random.randint(0, 30))
        requests.append({
            "requested_project_name": random.choice(projects),
            "project_display": random.choice(projects),
            "item_name": random.choice(items),
            "requested_quantity": random.randint(5, 50),
            "requested_date": request_date.strftime("%Y-%m-%d")
        })

    return requests

@app.post("/consume", response_model=ConsumeResponse)
async def consume_topic(request: ConsumeRequest):
    if request.topic == "scm_inventory":
        data = generate_inventory_data(request.limit)
    elif request.topic == "scm_requests":
        data = generate_requests_data(request.limit)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown topic: {request.topic}")

    messages = [{"value": item} for item in data]

    return ConsumeResponse(
        count=len(messages),
        messages=messages
    )

@app.get("/")
async def root():
    return {"message": "SCM Kafka API Mock Server", "topics": ["scm_inventory", "scm_requests"]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)