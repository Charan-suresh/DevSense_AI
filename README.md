# 🧠 DevSense AI

**Stop context-switching to fix bugs. Let DevSense catch you the moment you're stuck.**

DevSense AI is a non-intrusive, intelligent developer productivity engine that runs quietly in the background of VS Code. It proactively detects **"code stalls"** — periods of friction caused by persistent bugs, repeated errors, or code thrashing — and delivers surgical, AI-powered fixes directly inline, exactly where you're stuck. Powered by the Groq LLaMA-3 inference engine, DevSense eliminates the need to break flow, tab over to a chat window, or manually prompt an AI.

---

## 🎯 The Problem

Developers frequently get stuck in code stalls: idle loops, repeated errors, and code thrashing that goes unnoticed until it's already cost real time. Existing AI coding tools typically make things worse before they help — you have to *notice* you're stuck, *switch* to a chat window, and *manually* explain the problem before getting an answer.

## 🚀 Our Solution

DevSense AI lives entirely in the background. It watches your flow natively inside VS Code and **only interrupts when it detects you're actually struggling** — never proactively, never distractingly. Once a stall is detected, it uses **LLaMA-3.3-70b via Groq** to instantly generate a fix and projects it right above the broken code.

### ✨ What It Does

| | |
|---|---|
| 💡 **Explains the Root Cause** | A one-line explanation of why the code broke |
| ⚡ **Shows the Fix Inline** | A specific, actionable summary of the required fix |
| ✨ **Applies the Fix Automatically** | An interactive CodeLens button that rewrites the broken code with a single click |

### 📊 Why DevSense Is Different

![DevSense comparison across activation, context awareness, and workflow impact](assets/devsense_comparison.png)

---

## 🕵️‍♂️ How It Detects Stalls

A master `StallDetector` fires the AI resolution engine when it detects **overlapping** stall signals in the active file — not just one in isolation. Today, it watches for combinations of:

1. 🕒 **Idle Tracker** — the developer stops typing or moving their cursor for ~10 seconds while the file remains in a broken state.
2. 🐛 **Persistent Bug Tracker** — the same diagnostic error (from Pylance, IntelliSense, etc.) persists across multiple edits.
3. 🔄 **Code Thrashing Tracker** — the same code block is edited 3+ times without resolving the issue.
4. ▶️ **Repeated Failed Runs** — the same file keeps failing across repeated terminal or task executions.
5. 📉 **Lack of Progress** — errors remain active after multiple edits and failed runs with no improvement.

---

## 🏗️ Architecture & Tech Stack

| Layer | Stack | Role |
|---|---|---|
| **Frontend (VS Code Extension)** | TypeScript | Uses WebSockets for real-time payload delivery and VS Code's native `CodeLensProvider` to inject AI suggestions inline without breaking flow |
| **Backend Server** | FastAPI / Python | Lightweight WebSocket server routing editor context and active compiler configs to the LLM |
| **AI Brain** | Groq (`llama-3.3-70b-versatile`) | Extremely low-latency, highly contextual code diagnostics |
| **Telemetry Dashboard** | Streamlit | Reads `stall_log.jsonl` to visualize team bottlenecks, stall distribution by language, and AI resolution success rates |

### 📈 Dashboard Preview

![DevSense stall detection dashboard preview](assets/dashboard_preview.png)

---

## 🛠️ Getting Started

### 0. Clone the Repository

```bash
git clone https://github.com/Charan-suresh/DevSense_AI.git
cd DevSense_AI
python3 -m venv .venv
source .venv/bin/activate
```

### 1. Backend Server Setup

```bash
# 1. Activate the virtual environment and install dependencies
source .venv/bin/activate
pip install -r requirements.txt

# 2. Add your own Groq API key to the .env file
echo "GROQ_API_KEY=gsk_your_api_key_here" > .env

# 3. Launch the FastAPI WebSocket server
export $(cat .env | xargs) && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload --reload-exclude .venv
```

> ⚠️ The backend must be running before the VS Code extension can send a stall payload and receive an AI-generated fix.

### 2. VS Code Extension Setup

```bash
cd stall-detector
npm install
npm run compile
code --extensionDevelopmentPath=$(pwd) ../
```

*Alternatively: open the `stall-detector` folder in VS Code and press **F5** to auto-attach the debugger.*

Once active, DevSense surfaces suggestions inline via CodeLenses and shows a VS Code notification when a resolution arrives.

### 3. Open the Analytics Dashboard (Optional)

```bash
streamlit run dashboard/app.py
```

#### 🌍 Sharing the Dashboard Worldwide

To make your locally running dashboard accessible over the internet without deploying it, expose port `8501` via **[ngrok](https://ngrok.com/)**:

```bash
# 1. Install ngrok, if needed
brew install ngrok/ngrok/ngrok

# 2. Start a secure tunnel to the dashboard
ngrok http 8501
```

---

## 💡 See It In Action

1. In the **Extension Development Host** window, open any Python or C++ file.
2. Intentionally introduce a syntax or logic error (e.g., `print(undefined_variable)`).
3. Wait for the red squiggly line to appear.
4. Make a few edits that don't fix the problem, or repeatedly run the broken file from the integrated terminal.
5. Stop typing and leave the cursor idle for ~10 seconds.
6. DevSense detects the overlapping stall signals and pings the local WebSocket backend → Groq.
7. You'll see a VS Code notification plus three CodeLenses in the editor:
   - 💡 An explanation of the problem
   - ⚡ A summary of the fix
   - ✨ An interactive **Apply Fix** button
8. Click **✨ Apply Fix** — the code is instantly and automatically repaired.

---

<p align="center">Built to keep developers in flow, one resolved stall at a time.</p>
