import json
from datetime import datetime, date
import math
import os
import streamlit as st
from streamlit_autorefresh import st_autorefresh

STALLED_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "data",
    "stall_log.json",
)

st.set_page_config(page_title="DevSense Stall Monitor", layout="wide")

st.title("DevSense Stall Detection Dashboard")
st.write("Realtime, anonymised stall analytics from local stall_log.json")

# 10 second auto-refresh
st_autorefresh(interval=10_000, key="auto_refresh")


def load_data(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            raw = f.read().strip()

        if not raw:
            return []

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = [json.loads(line) for line in raw.splitlines() if line.strip()]

        if not isinstance(data, list):
            raise ValueError("stall_log.json must contain a list of stall events or JSON lines")

        return data
    except FileNotFoundError:
        st.error(f"Config file '{file_path}' not found.")
        return []
    except json.JSONDecodeError as exc:
        st.error(f"JSON decode error in '{file_path}': {exc}")
        return []
    except Exception as exc:
        st.error(f"Error loading '{file_path}': {exc}")
        return []


def parse_timestamp(row):
    raw = row.get("timestamp") or ""
    try:
        return datetime.fromisoformat(raw)
    except Exception:
        return None


def render_pie_svg(counts):
    total = sum(counts.values())
    if total <= 0:
        return "<p>No data to draw pie chart.</p>"

    colors = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948"]
    cx, cy, r = 150, 150, 120
    start_angle = 0
    paths = []

    for i, (label, value) in enumerate(counts.items()):
        angle = value / total * 2 * math.pi
        end_angle = start_angle + angle

        x1 = cx + r * math.cos(start_angle)
        y1 = cy + r * math.sin(start_angle)
        x2 = cx + r * math.cos(end_angle)
        y2 = cy + r * math.sin(end_angle)

        large_arc_flag = 1 if angle > math.pi else 0
        color = colors[i % len(colors)]

        path = f"M {cx} {cy} L {x1:.3f} {y1:.3f} A {r} {r} 0 {large_arc_flag} 1 {x2:.3f} {y2:.3f} Z"
        label_pct = f"{label} ({value}, {value/total*100:.1f}%)"
        paths.append((path, color, label_pct))

        start_angle = end_angle

    legend_items = "".join([
        f"<div style='display: flex; align-items:center; margin:2px;'><span style='width:14px; height:14px; background:{c}; display:inline-block; margin-right:6px;'></span>{text}</div>"
        for _, c, text in paths
    ])

    sections = "".join([
        f"<path d='{path}' fill='{color}' stroke='#ffffff' stroke-width='1'></path>"
        for path, color, _ in paths
    ])

    svg = f"""
    <div style='display:flex; gap:20px; align-items:center;'>
      <svg width='320' height='320' viewBox='0 0 300 300' style='border:1px solid #ddd; background:#fff'>{sections}</svg>
      <div style='font-size:14px;'>{legend_items}</div>
    </div>
    """

    return svg


def prepare_metrics(events):
    today = date.today()
    today_events = [ev for ev in events if parse_timestamp(ev) and parse_timestamp(ev).date() == today]
    total_today = len(today_events)

    by_language = {}
    by_type = {"idle": 0, "repeated_edit": 0, "repeated_error": 0}
    resolved = 0

    for ev in events:
        lang = ev.get("language", "Unknown")
        by_language[lang] = by_language.get(lang, 0) + 1

        t = ev.get("stall_type", "unknown")
        if t in by_type:
            by_type[t] += 1
        else:
            by_type[t] = by_type.get(t, 0) + 1

        if ev.get("resolution_status") == "resolved":
            resolved += 1

    total_events = len(events)
    resolution_rate = (resolved / total_events * 100) if total_events > 0 else 0.0

    return {
        "total_today": total_today,
        "by_language": by_language,
        "by_type": by_type,
        "resolution_rate": round(resolution_rate, 2),
    }


def last_n_stalls(events, n=5):
    decorated = []
    for ev in events:
        ts = parse_timestamp(ev)
        decorated.append((ts or datetime.min, ev))
    decorated.sort(key=lambda x: x[0], reverse=True)
    recent = [e for _, e in decorated[:n]]
    for r in recent:
        r["timestamp"] = r.get("timestamp") or "(invalid)"
    return recent


def main():
    events = load_data(STALLED_FILE)

    metrics = prepare_metrics(events)

    col1, col2, col3 = st.columns(3)
    col1.metric("Total stalls detected today", metrics["total_today"])
    col2.metric("Resolution rate", f"{metrics['resolution_rate']}%")

    st.markdown("---")

    c1, c2 = st.columns(2)
    with c1:
        st.subheader("Stalls by programming language")
        if metrics["by_language"]:
            st.bar_chart(metrics["by_language"])
        else:
            st.info("No stall events yet.")

    with c2:
        st.subheader("Stalls by type")
        if metrics["by_type"]:
            st.markdown(render_pie_svg(metrics["by_type"]), unsafe_allow_html=True)
        else:
            st.info("No stall events yet.")

    st.markdown("---")
    st.subheader("Latest 5 stall events")

    recent = last_n_stalls(events, 5)
    st.table(recent)


if __name__ == "__main__":
    main()
