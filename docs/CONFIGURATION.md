# Environment configuration

Copy `.env.example` to `.env` for local development. Set the same required values in your hosting provider's server environment for deployed builds.

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

The current AI client removes blank and duplicate keys. It tries configured keys in order and advances after HTTP 402/429 quota or billing responses and HTTP 401/403 credential responses. Keep every Groq key server-side.

## EDITH NETWORK

EDITH NETWORK provides optional server-mediated actions such as web search, page fetching, website opening, world-news dashboard access, and multi-step tasks.

Set `EDITH_NETWORK_API_KEY` in the server environment when enabling this integration. The credential is sent only from server-side code and must never be exposed through a `VITE_*` variable or sent to browser code. Existing deployments can continue using the previous variable name temporarily, but new deployments should use `EDITH_NETWORK_API_KEY`. The credential is shared across users of the same deployment, so apply suitable usage limits and monitor the external service.

## Optional project identifiers

`SUPABASE_PROJECT_ID` and `VITE_SUPABASE_PROJECT_ID` are included in the example template for integrations that need the project identifier. They are not required by the core chat server path.

## Authentication

EDITH currently uses Supabase Anonymous Sign-Ins to create a per-browser session. It does not implement a site password or password-based login. Anonymous sessions are not verified personal accounts; configure and test strict Row Level Security policies for user-owned data.

## Vercel deployment

1. Open the Vercel project and navigate to **Settings → Environment Variables**.
2. Add the required Supabase and Groq values.
3. Add the EDITH NETWORK credential only if that integration is enabled.
4. Select the environments that need each value (Production, Preview, and Development).
5. Save and trigger a new deployment.

Environment variable changes do not alter an already-built deployment. Redeploy after changing them.

## Local development

Edit `.env`, then restart the development server so Vite and the server runtime reload the values. Never commit the real `.env` file.

See [SETUP.md](../SETUP.md) for the complete installation and deployment walkthrough and [SECURITY.md](SECURITY.md) for credential handling guidance.
