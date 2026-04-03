from fastapi import FastAPI, WebSocket
from claude_handler import resolve_stall
import json
from datetime import datetime
import os

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_json()
            resolution = await resolve_stall(data)
            await websocket.send_json({"resolution": resolution})
            
            # Log the stall anonymously
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "language": data["language"],
                "stall_type": data["stall_type"],
                "resolution_status": "resolved" if resolution else "unresolved"
            }
            
            # Append to stall_log.json
            with open("stall_log.json", "a") as f:
                json.dump(log_entry, f)
                f.write("\n")
        except Exception as e:
            await websocket.send_json({"error": str(e)})
            break

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)