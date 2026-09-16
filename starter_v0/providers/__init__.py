from providers.openai_provider import OpenAIProvider
from providers.openrouter_provider import OpenRouterProvider
from providers.groq_provider import GroqProvider
from providers.anthropic_provider import AnthropicProvider
from providers.gemini_provider import GeminiProvider


def make_provider(name: str):
    if name == "openai":
        return OpenAIProvider()
    if name == "openrouter":
        return OpenRouterProvider()
    if name == "groq":
        return GroqProvider()
    if name == "anthropic":
        return AnthropicProvider()
    if name == "gemini":
        return GeminiProvider()
    raise ValueError(f"Unknown provider: {name}")
