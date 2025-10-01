from openai import OpenAI
import os, sys

def call_llm(prompt: str) -> str:
    """
    Calls OpenAI with modern SDK and robust fallbacks.
    Primary: gpt-5-mini, then gpt-5, then gpt-4o-mini, then gpt-4o.
    Returns assistant text (Markdown). Raises if all models fail.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    models = ["gpt-5-mini", "gpt-5", "gpt-4o-mini", "gpt-4o"]
    last_error = None

    for model_name in models:
        try:
            resp = client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a blog post writer for luggage-scale.com. "
                            "Produce only valid Markdown and strictly follow the constraints."
                        )
                    },
                    {"role": "user", "content": prompt}
                ],
                # В chat.completions корректный параметр — max_tokens
                max_tokens=2500,
            )
            content = (resp.choices[0].message.content or "").strip()
            prompt_tok = getattr(getattr(resp, "usage", None), "prompt_tokens", "n/a")
            comp_tok = getattr(getattr(resp, "usage", None), "completion_tokens", "n/a")
            print(f"ℹ️ LLM model used: {model_name}; prompt_tokens={prompt_tok}; completion_tokens={comp_tok}")
            if not content:
                # Пустой ответ — считаем невалидным и пробуем следующую модель
                print(f"⚠️ Empty content from {model_name}", file=sys.stderr)
                continue
            return content
        except Exception as e:
            print(f"⚠️ {model_name} failed: {e}", file=sys.stderr)
            last_error = e
            continue

    raise RuntimeError(f"All fallback models failed. Last error: {last_error}")
