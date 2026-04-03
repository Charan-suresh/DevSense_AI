import asyncio
import os
from groq import Groq

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

async def resolve_stall(payload):
    prompt = f"""You are DevSense, an AI co-pilot for developers. A developer is stalled with the following:

Code block: {payload.get('blockContent', '')}
Error message: {payload.get('errorMessage', 'None')}
Language: {payload.get('language', 'unknown')}
Stall type: {payload.get('stallType', 'unknown')}

Provide a concise, actionable resolution. You MUST reply with a JSON object containing EXACTLY these three keys:
- "fix": A short, actionable description of how to fix it.
- "explanation": A one-line explanation of the root cause.
- "codeToReplace": The exact corrected line(s) to replace the faulty line(s). Do NOT use markdown code blocks, just raw string text.
"""

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model="llama-3.3-70b-versatile",
        max_tokens=1000,
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": prompt}]
    )
    import json
    try:
        return json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return {
            "fix": "Error generating structured fix.",
            "explanation": "Could not parse JSON.",
            "codeToReplace": ""
        }