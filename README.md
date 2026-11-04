# EDITH X1

EDITH X1 is a Jarvis-inspired assistant built with React, TypeScript, TanStack Start, Vite, and Supabase. It provides authenticated AI chat, voice input and local speech playback, configurable assistant behavior, and an EDITH NETWORK execution layer.

## Quick start

See **[SETUP.md](SETUP.md)** for complete prerequisites, environment variables, local development, testing, and deployment instructions.

```sh
git clone https://github.com/sectorx83/edithx1.git
cd edithx1
bun install
cp .env.example .env
# Add your Supabase and Groq credentials to .env
bun run dev
```

## AI provider

Chat uses Groq's OpenAI-compatible Chat Completions API. The default model is `openai/gpt-oss-120b`; override it with `GROQ_MODEL`. Provider credentials are read only by server-side code and must never be exposed through `VITE_*` variables.

## Project documentation

- [Setup and deployment](SETUP.md)
- [AI engine](docs/AI_ENGINE.md)
- [Environment configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)
