from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from kafka import KafkaProducer, KafkaConsumer
from typing import List
import json
import os
import math


# ---------------- Config ----------------
KAFKA_BROKER = os.getenv("KAFKA_BROKER", "kafka:9092")  # Docker network hostname
DEFAULT_TOPIC = os.getenv("KAFKA_TOPIC", "scm_topic")

app = FastAPI(title="Kafka API", version="1.0")

# ---------------- Producer Setup ----------------
producer = KafkaProducer(
    bootstrap_servers=[KAFKA_BROKER],
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

# ---------------- Request Models ----------------
class ProduceMessage(BaseModel):
    topic: str = DEFAULT_TOPIC
    key: str | None = None
    value: dict

class ConsumeRequest(BaseModel):
    topic: str = DEFAULT_TOPIC
    group_id: str = "scm_api_group"
    auto_offset_reset: str = "latest"  # or "earliest"
    limit: int = 10  # how many messages to return

# ---------------- JSON Sanitizer ----------------
def _sanitize_for_json(obj):
    """Recursively convert objects to JSON-safe native types.

    - Converts numpy/pandas scalars/arrays via .item()/.tolist() when available.
    - Replaces NaN/Inf floats with None.
    - Recursively sanitizes dicts and lists.
    - Falls back to string for unknown objects.
    """
    # None, bool, int, str are safe
    if obj is None or isinstance(obj, (bool, int, str)):
        return obj

    # float handling (catch NaN / Inf)
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj

    # numpy / pandas scalars often implement .item()
    if hasattr(obj, 'item') and callable(getattr(obj, 'item')):
        try:
            return _sanitize_for_json(obj.item())
        except Exception:
            pass

    # arrays / series often implement .tolist()
    if hasattr(obj, 'tolist') and callable(getattr(obj, 'tolist')):
        try:
            return _sanitize_for_json(obj.tolist())
        except Exception:
            pass

    # dicts and sequences
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]

    # As a last resort, coerce to string to preserve information
    try:
        return str(obj)
    except Exception:
        return None

# ---------------- Routes ----------------
@app.get("/health")
async def health():
    return {"status": "ok", "broker": KAFKA_BROKER, "default_topic": DEFAULT_TOPIC}


@app.post("/produce")
async def produce_message(msg: ProduceMessage):
    try:
        future = producer.send(
            msg.topic,
            key=msg.key.encode("utf-8") if msg.key else None,
            value=msg.value
        )
        future.get(timeout=10)
        return {"status": "success", "topic": msg.topic, "value": msg.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consume")
async def consume_messages(req: ConsumeRequest):
    try:
        consumer = KafkaConsumer(
            req.topic,
            bootstrap_servers=[KAFKA_BROKER],
            group_id=req.group_id,
            auto_offset_reset=req.auto_offset_reset,
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            enable_auto_commit=True,
            consumer_timeout_ms=5000
        )

        messages: List[dict] = []
        for i, msg in enumerate(consumer):
            if i >= req.limit:
                break
            sanitized_value = _sanitize_for_json(msg.value)
            messages.append({
                "topic": msg.topic,
                "partition": msg.partition,
                "offset": msg.offset,
                "key": msg.key.decode("utf-8") if msg.key else None,
                "value": sanitized_value
            })

        consumer.close()
        # Sanitize the entire response to ensure no NaN/Inf or non-serializable
        # objects remain (these can still slip through from nested structures).
        response_body = {"count": len(messages), "messages": messages}
        safe_body = _sanitize_for_json(response_body)
        return safe_body

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
