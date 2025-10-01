
import os
import openai

def call_llm(prompt: str) -> str:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    if not openai.api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    resp = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=4096,
    )
    return resp["choices"][0]["message"]["content"]
