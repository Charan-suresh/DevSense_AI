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

Provide a concise, actionable resolution or suggestion to help the developer proceed."""

    response = await asyncio.to_thread(
        client.chat.completions.create,
        model="llama-3.3-70b-versatile",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content