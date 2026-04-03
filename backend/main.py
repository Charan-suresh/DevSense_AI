import os
import json
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.claude_handler import resolve_stall

app = FastAPI(title="DevSense AI Backend")

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
STALL_LOG_FILE = os.path.join(BASE_DIR, "data", "stall_log.json")
os.makedirs(os.path.dirname(STALL_LOG_FILE), exist_ok=True)


@app.get("/")
def root():
    return {"status": "DevSense backend running"}


@app.post("/resolve")
async def resolve(data: dict):
    try:
        resolution = await resolve_stall(data)

        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "language": data.get("language"),
            "stall_type": data.get("stall_type"),
            "resolution_status": "resolved" if resolution else "unresolved",
        }

        with open(STALL_LOG_FILE, "a") as f:
            json.dump(log_entry, f)
            f.write("\n")

        return {"resolution": resolution}
    except Exception as e:
        return {"error": str(e)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            resolution = await resolve_stall(data)
            await websocket.send_json({"resolution": resolution})

            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "language": data.get("language"),
                "stall_type": data.get("stall_type"),
                "resolution_status": "resolved" if resolution else "unresolved",
            }

            with open(STALL_LOG_FILE, "a") as f:
                json.dump(log_entry, f)
                f.write("\n")
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        await websocket.send_json({"error": str(e)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
