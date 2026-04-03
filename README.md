# DevSense Stall Detection Dashboard

An interactive Streamlit dashboard visualizing anonymised stall logs from DevSense local backend telemetry.

## Problem Statement

Developers can get stuck in code stalls (idle loops, repeated edits, repeated errors) without fast observable insights. Existing tooling may not display real-time stall detection metrics and live timeline updates for mitigation.

## Proposed Solution

We ingest local `stall_log.json` events from DevSense backend logs and render a real-time Streamlit dashboard.
- Compute today’s stalls, resolution rate, language and type distributions.
- Provide a live-feed table of last 5 events.
- Auto-refresh every 10 seconds for real-time updates.
- No database required, simple JSON source only.

## Tech Stack

- Python 3.10+
- Streamlit
- JSON (standard library)
- Optional: Streamlit Community Cloud for deployment

## Architecture (text-based)

Local file (`stall_log.json`) -> Python parser (`app.py`) -> Streamlit components:
- Metric cards
- Bar chart (language)
- Pie chart (stall type)
- Table (last 5 events)
- Auto refresh (10s)

## Live Demo Link (Streamlit)

- Deployed URL: `https://your-streamlit-app-link.streamlit.app` (replace with actual after deployment)

## Demo Video

- Video link: `https://youtu.be/your-demo-video` (replace with public/unlisted YouTube or Google Drive URL)

## Setup and Run Locally

1. Install dependencies:

```bash
pip install streamlit
```

2. Confirm `stall_log.json` exists in the same folder as `app.py`.

3. Start the app:

```bash
cd c:\Users\DELL\OneDrive\Desktop\DevSense_AI
streamlit run app.py
```

4. Edit `stall_log.json`, and within 10 seconds Streamlit auto-refresh shows updates.

## Deployment

1. Create a Streamlit Community Cloud account.
2. Connect GitHub repo.
3. Deploy from this branch.
4. Use generated URL as Live Demo Link in Form 2.

---

### Stall log format required

```json
[
  {
    "timestamp": "2026-04-03T14:23:00",
    "language": "Python",
    "stall_type": "repeated_error",
    "resolution_status": "resolved"
  }
]
```
