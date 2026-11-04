# EDITH X1

EDITH X1 is a Jarvis-inspired AI assistant built with React, TanStack Start, TypeScript, and Supabase. The project includes a web chat experience, voice input/output, user-configurable assistant behavior, and an authenticated server-side AI and network execution layer.

**Live app:** https://edithx1.lovable.app

## AI provider

Chat uses the Groq API through a server-only integration. The default model is `openai/gpt-oss-120b`; set `GROQ_MODEL` to use another model available to your Groq account.

The browser never receives the Groq API key. Requests are made by the server, which supports a pool of up to four keys and rotates to another key after quota/billing or authentication failures.

See [AI engine setup](docs/AI_ENGINE.md) and [configuration](docs/CONFIGURATION.md).

## Requirements

- Node.js (use the version supported by the project toolchain)
- npm
- A Supabase project connected to the application
- A Groq API key for chat

## Local development

```sh
git clone https://github.com/sectorx83/edithx1.git
cd edithx1
npm install
cp .env.example .env
npm run dev
```

Fill in the required values in `.env` before starting the app. Never commit the real `.env` file.

Useful commands:

```sh
npm run dev       # Start the development server
npm run build     # Create a production build
npm run lint      # Run ESLint
npm test          # Run the test suite
```

## Deployment

Configure the environment variables in your hosting provider before deploying. For Vercel, add them under **Project → Settings → Environment Variables**, select the environments that should receive them, and redeploy after changing values.

Required server configuration:
- `GROQ_API_KEY_1` (or `GROQ_API_KEY`)
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

The Vite client can also use `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` where required by the deployment setup. Do not put Groq credentials in any `VITE_*` variable.

## Documentation

- [AI engine](docs/AI_ENGINE.md)
- [Environment configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Lovable

This repository is connected to [Lovable](https://lovable.dev). Changes committed to the connected branch may sync to the Lovable project. Avoid rewriting published Git history.
