# backend/gemini/call_gemini.py
import os
import sys
from dotenv import load_dotenv, find_dotenv  # type: ignore

from google import genai  # type: ignore
from google.genai import types  # type: ignore

# Load .env (if present)
dotenv_path = find_dotenv()
if dotenv_path:
    load_dotenv(dotenv_path)
else:
    load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not set. Create a .env file with GEMINI_API_KEY=your_key", file=sys.stderr)
    sys.exit(1)

client = genai.Client(api_key=api_key)


def generate_response(system_prompt: str, prompt: str, model: str = None):
    """
    Generate a response using the Gemini client.
    system_prompt must be provided (string). prompt is the user prompt.
    model: optional. If None, we will check environment GEMINI_FAST_MODEL, otherwise fall back to 'gemini-2.5-flash'.
    """
    try:
        # Determine the model to use: explicit argument -> env -> fallback
        model_to_use = model or os.environ.get("GEMINI_FAST_MODEL", "gemini-2.5-flash")

        # Make sure system_prompt is a string
        system_instruction = system_prompt if isinstance(system_prompt, str) else str(system_prompt)

        # Create a minimal config. Keep it small; we rely on system instruction for strictness.
        config = types.GenerateContentConfig(system_instruction=system_instruction)

        response = client.models.generate_content(
            model=model_to_use,
            config=config,
            contents=prompt
        )

        return response.text

    except Exception as e:
        # propagate so callers may handle/log
        raise RuntimeError(f"API request failed {e}")


if __name__ == "__main__":
    print(generate_response(system_prompt="You are friendly", prompt="Explain to me what gemini is"))
