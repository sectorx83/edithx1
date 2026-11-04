# Environment configuration

Create a local `.env` from `.env.example`. Keep real values private and never commit `.env`.

## Required values

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY_1` | Primary Groq API key for chat. |
| `SUPABASE_URL` | Supabase project URL used by the server. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key. |

At least one Groq key is required. You can use `GROQ_API_KEY` instead of `GROQ_API_KEY_1`.

## Optional Groq values

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY_2` to `GROQ_API_KEY_4` | Additional keys for quota/credential failover. |
| `GROQ_API_KEY` | Single-key fallback/additional pool key. |
| `GROQ_MODEL` | Model ID; defaults to `openai/gpt-oss-120b`. |

## Optional client build values

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase URL exposed to the Vite client build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key exposed to the Vite client build. |

Only public Supabase configuration belongs in `VITE_*` variables. Never use a `VITE_*` prefix for Groq keys, Supabase secret keys, service-role keys, or other credentials.

## Vercel

1. Open the Vercel project.
2. Go to **Settings → Environment Variables**.
3. Add the required variables and select the appropriate environments (Production, Preview, and/or Development).
4. Save the values.
5. Redeploy so the new server environment is applied.

Changing environment variables does not update an already-running deployment until it is redeployed.
