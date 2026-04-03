import asyncio
import anthropic
import os

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

async def resolve_stall(payload):
    prompt = f"""
You are DevSense, an AI co-pilot for developers. A developer is stalled with the following:

Code: {payload['code']}
Error: {payload['error']}
Language: {payload['language']}
Stall type: {payload['stall_type']}

Provide a concise resolution or suggestion to help the developer proceed.
"""
    response = await asyncio.to_thread(
        client.messages.create,
        model="claude-3-sonnet-20240229",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.content[0].text