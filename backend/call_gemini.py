import os
import sys
from dotenv import load_dotenv, find_dotenv

from google import genai
from google.genai import types

# Load .env (if present)
dotenv_path = find_dotenv()
if dotenv_path:
    load_dotenv(dotenv_path)
else:
    load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("ERROR: GEMINI_API_KEY not set. Create a .env file with GEMINI_API_KEY=your_key", file=sys.stderr)
    # Keep existing behavior of exiting so the router can catch SystemExit
    sys.exit(1)

client = genai.Client(api_key=api_key)

def generate_response(system_prompt: str, prompt: str, model: str = "gemini-2.5-flash"):
    """
    Generate a response using the Gemini client.
    *system_prompt* must be provided (string). *prompt* is the user prompt.
    """
    try:
        # Make sure system_prompt is a string
        system_instruction = system_prompt if isinstance(system_prompt, str) else str(system_prompt)
        config = types.GenerateContentConfig(system_instruction=system_instruction)

        response = client.models.generate_content(
            model=model,
            config=config,
            contents=prompt
        )

        # Response wrapper exposes .text in your previous code
        return response.text

    except Exception as e:
        # Keep raising so callers can handle/log as appropriate
        raise RuntimeError(f"API request failed {e}")

if __name__ == "__main__":

    print(generate_response(system_prompt="You are friendly", prompt="Explain to me what gemini is"))