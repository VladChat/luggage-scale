from openai import OpenAI
import os

def call_llm(prompt: str, *, effort: str = "medium", verbosity: str = "medium") -> str:
    """
    Calls OpenAI with the Responses API and single-attempt fallbacks.
    Order: gpt-5 → gpt-5-mini → gpt-4o → gpt-4o-mini.
    GPT-5-specific controls:
      - reasoning.effort:  "minimal" | "low" | "medium" | "high"
      - text.verbosity:    "low" | "medium" | "high"
      - max_output_tokens: replaces max_completion_tokens
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    # Порядок попыток: сначала GPT-5, затем мини, затем 4o-семейство.
    model_candidates = ["gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4o-mini"]
    last_error = None

    system_prompt = (
        "You are a blog post writer for luggage-scale.com. "
        "Produce only valid Markdown and strictly follow the constraints."
    )

    for model_name in model_candidates:
        try:
            # Responses API поддерживает передачу ролей в input как списка сообщений
            resp = client.responses.create(
                model=model_name,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                reasoning={"effort": effort},   # GPT-5 control
                text={"verbosity": verbosity},  # GPT-5 control
                max_output_tokens=2500,         # вместо max_completion_tokens
            )

            # Унифицированное извлечение текста (Responses API)
            content = (getattr(resp, "output_text", "") or "").strip()

            # Запасной путь: если SDK вернул разметку кусками
            if not content and hasattr(resp, "output") and resp.output:
                chunks = []
                for item in resp.output:
                    # item.type может быть "message"; item.content — список блоков
                    if getattr(item, "type", None) == "message":
                        for block in (getattr(item, "content", None) or []):
                            # block.type может быть "output_text" или "text"
                            text_val = getattr(block, "text", None)
                            if isinstance(text_val, str) and text_val.strip():
                                chunks.append(text_val.strip())
                content = "\n".join(chunks).strip()

            # Логирование токенов (если доступны)
            usage = getattr(resp, "usage", None)
            in_tok = getattr(usage, "input_tokens", None)
            out_tok = getattr(usage, "output_tokens", None)
            print(f"ℹ️ Used model {model_name}, input_tokens={in_tok}, output_tokens={out_tok}")

            if content:
                return content
            else:
                print(f"⚠️ {model_name} returned empty content.")
                # переходим к следующей модели

        except Exception as e:
            print(f"⚠️ {model_name} failed: {e}")
            last_error = e
            # переходим к следующей модели

    raise RuntimeError(f"All fallback models failed. Last error: {last_error}")
