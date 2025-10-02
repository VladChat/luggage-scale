from openai import OpenAI
import os
from openai import OpenAIError, RateLimitError

def call_llm(prompt: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    # Ordered fallback list
    model_candidates = ["gpt-5-mini", "gpt-5", "gpt-4o-mini", "gpt-4o"]
    last_error = None

    def try_model(model_name: str):
        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a blog post writer for luggage-scale.com. "
                        "Produce only valid Markdown and strictly follow the constraints."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=2500,
        )
        content = (resp.choices[0].message.content or "").strip()
        return content, resp

    # Try each model once
    for model_name in model_candidates:
        try:
            content, resp = try_model(model_name)
            pt = getattr(resp.usage, "prompt_tokens", None)
            ct = getattr(resp.usage, "completion_tokens", None)
            print(f"ℹ️ Used model {model_name}, prompt_tokens={pt}, completion_tokens={ct}")

            if content:
                return content
            else:
                print(f"⚠️ {model_name} returned empty content.")
                # move to next model

        except (RateLimitError, OpenAIError) as e:
            print(f"⚠️ {model_name} failed: {e}")
            last_error = e
            # move to next model

    raise RuntimeError(f"All fallback models failed. Last error: {last_error}")
