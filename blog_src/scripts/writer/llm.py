from openai import OpenAI
import os

def call_llm(prompt: str) -> str:
    \"""
    Calls OpenAI ChatCompletion API with GPT-5 models.
    Uses gpt-5-mini primarily, falls back to gpt-5 if unavailable.
    Returns the assistant's response text.
    \"""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    # Список моделей по приоритету
    models = ["gpt-5-mini", "gpt-5"]

    last_error = None
    for model_name in models:
        try:
            resp = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a blog post writer for luggage-scale.com. Write in English."},
                    {"role": "user", "content": prompt}
                ],
                max_completion_tokens=2500
            )
            return resp.choices[0].message.content.strip()
        except Exception as e:
            last_error = e
            continue

    raise RuntimeError(f"All fallback models failed. Last error: {last_error}")
