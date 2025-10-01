from openai import OpenAI
import os

def call_llm(prompt: str) -> str:
    """
    Calls the OpenAI ChatCompletion API with the given prompt.
    Returns the assistant's response text.
    """
    # Инициализация клиента — ключ берётся из переменной окружения OPENAI_API_KEY
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    resp = client.chat.completions.create(
        model="gpt-4o-mini",  # можно заменить на gpt-3.5-turbo, если нужно дешевле
        messages=[
            {"role": "system", "content": "You are a blog post writer for luggage-scale.com. Write in English."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=1500
    )

    return resp.choices[0].message.content.strip()
