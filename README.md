# DevSense Backend

FastAPI backend for DevSense AI co-pilot.

## Local Development

1. Install dependencies: `pip install -r requirements.txt`
2. Set environment variable: `export ANTHROPIC_API_KEY=your_key_here`
3. Run: `uvicorn main:app --reload`

## Deployment

### Render

1. Push this code to a GitHub repo.
2. Go to Render.com, create a new Web Service.
3. Connect your GitHub repo.
4. Set build command: `pip install -r requirements.txt`
5. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable: `ANTHROPIC_API_KEY` with your key.
7. Deploy.

The WebSocket URL will be `wss://your-app-name.onrender.com/ws`

### Railway

1. Push to GitHub.
2. Go to Railway.app, create new project from GitHub.
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env var `ANTHROPIC_API_KEY`.
6. Deploy.

WebSocket URL: `wss://your-project-name.up.railway.app/ws`

Update the VS Code extension to use the deployed WebSocket URL instead of ws://localhost:8000/ws.