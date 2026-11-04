# EDITH X1

**EDITH X1** is a multi-user AI assistant web application built with React, TypeScript, TanStack Start, Vite, and Supabase. It provides AI chat with automatic anonymous sessions, voice input and local speech playback, configurable assistant behavior, and an EDITH NETWORK execution layer.

**Live application:** https://www.edithx1.vercel.app

## Get started

Read the complete [Setup Guide](SETUP.md) for prerequisites, Supabase configuration, Groq setup, local development, testing, and deployment.

```sh
git clone https://github.com/sectorx83/edithx1.git
cd edithx1
bun install
cp .env.example .env
# Configure Supabase and Groq values in .env
bun run dev
```

## AI provider

Chat uses Groq's OpenAI-compatible Chat Completions API. The default model is `openai/gpt-oss-120b`; override it with `GROQ_MODEL`. Provider credentials are read only by server-side code and must never be exposed through `VITE_*` variables.

## Documentation

- [Setup and deployment](SETUP.md)
- [AI engine](docs/AI_ENGINE.md)
- [Environment configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [License](LICENSE)
