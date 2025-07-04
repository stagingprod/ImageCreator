import os
import random
from dotenv import load_dotenv

load_dotenv()

def get_keys_from_env(prefix):
    keys = []
    # Support both numbered and single keys
    for i in range(1, 20):
        key = os.getenv(f"{prefix}_{i}")
        if key:
            keys.append(key)
    single = os.getenv(prefix)
    if single:
        keys.append(single)
    return list(set(keys))  # Remove duplicates

class APIKeyRotator:
    def __init__(self):
        self.openai_keys = get_keys_from_env("OPENAI_API_KEY")
        if not self.openai_keys:
            raise ValueError("No OpenAI API keys found in environment variables")

    def get_openai_key(self, exclude=None):
        keys = [k for k in self.openai_keys if k != exclude] if exclude else self.openai_keys
        return random.choice(keys)