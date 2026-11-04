# Environment configuration

Copy `.env.example` to `.env` for local development. Set the same variables in your hosting provider's server environment for deployed builds.

## Required server variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by server-side code. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. A legacy anon/public key is also supported. |
| `GROQ_API_KEY_1` or `GROQ_API_KEY` | At least one Groq key is required for AI chat. |

## Browser-visible Supabase variables

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL exposed to the browser build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key exposed to the browser build. |

These are public project values, not secrets. They should refer to the same Supabase project as the server variables.

## Optional Groq variables

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY_2` through `GROQ_API_KEY_4` | Additional keys tried after quota/billing or authentication failures. |
| `GROQ_API_KEY` | Single-key fallback or an additional pool key. |
| `GROQ_MODEL` | Groq model ID. Defaults to `openai/gpt-oss-120b`. |

The AI client removes blank and duplicate keys. Keep all Groq keys server-side. Never prefix provider credentials with `VITE_`.

## Optional project identifiers

`SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PROJECT_ID` are included in the example template for tools or client integrations that require the project identifier. They are not required by the core chat server path.

## Vercel deployment

1. Open the Vercel project and navigate to **Settings → Environment Variables**.
2. Add the required Supabase and Groq values.
3. Select the environments that need each value (Production, Preview, and/or Development).
4. Save and trigger a new deployment.

Environment variable changes do not alter an already-built deployment. Redeploy after changing them.

## Local development

Edit `.env`, then restart the development server so Vite and the server runtime reload the values. Never commit the real `.env` file.

See [SETUP.md](../SETUP.md) for the complete installation and deployment walkthrough and [SECURITY.md](SECURITY.md) for credential handling guidance.
