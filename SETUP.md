# EDITH X1 Setup Guide

This guide explains how to install, configure, run, test, and deploy EDITH X1. The project is designed as a multi-user application. Each deployment operator configures their own Supabase project and AI provider credentials.

## Requirements

- Git
- Node.js 22 or later
- Bun (recommended; this repository includes `bun.lock`)
- A Supabase project
- A Groq API key for AI chat

## 1. Clone and install

```sh
git clone https://github.com/sectorx83/edithx1.git
cd edithx1
bun install
```

If you use npm instead, run `npm install` and use npm for the remaining commands. Do not mix package managers within one working copy.

## 2. Configure Supabase

Create a project at https://supabase.com/dashboard. From its API settings, obtain the project URL and publishable key (or legacy anon/public key).

Provision the database schema and authentication configuration required by the application. Apply the database migrations included in this repository if applicable. Enable Anonymous Sign-Ins in Supabase Auth, since EDITH creates a per-browser Supabase session without asking users for a password.

## 3. Configure environment variables

Create a local environment file:

```sh
cp .env.example .env
```

Required server variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by server-side code. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (legacy anon/public key is accepted). |
| `GROQ_API_KEY_1` | Primary Groq API key for AI chat. |
| `STYX_NETWORK_API_KEY` | Edith Network API credential used by network tools. |

Client builds also require the corresponding public Supabase values:

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase URL exposed to the browser build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key exposed to the browser build. |

Optional Groq variables:

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY_2`-`GROQ_API_KEY_4` | Additional keys for quota/credential failover. |
| `GROQ_API_KEY` | Single-key fallback or an additional key in the pool. |
| `GROQ_MODEL` | Model ID; defaults to `openai/gpt-oss-120b`. |

Create a Groq key at https://console.groq.com/keys. At least one of `GROQ_API_KEY_1` or `GROQ_API_KEY` is required for AI chat.

EDITH NETWORK uses the shared `STYX_NETWORK_API_KEY` server variable. The key is sent only from server-side code and is not exposed to browser JavaScript. Do not rename it or prefix it with `VITE_`.

**Security:** variables prefixed with `VITE_` are exposed in the browser bundle. Only public Supabase configuration belongs there. Never put Groq keys, Edith Network credentials, Supabase secret/service-role keys, database passwords, or other private credentials in `VITE_*` variables. Keep `.env` private; it is ignored by Git.

## 4. Start locally

```sh
bun run dev
```

Or, if using npm:

```sh
npm run dev
```

Open the local URL printed by Vite.

## 5. Run quality checks

Run these before submitting changes or deploying:

```sh
bun run lint
bun run test
bun run build
```

The equivalent npm commands are `npm run lint`, `npm test`, and `npm run build`.

To preview a production build locally, run `bun run build` and then `bun run preview`.

## 6. Deploy to Vercel

1. Import this GitHub repository into your Vercel account.
2. Set the project root to the repository root.
3. Use the detected TanStack Start/Vite settings or set the build command to `bun run build`.
4. Add the required environment variables from section 3 in Project Settings → Environment Variables.
5. Apply them to Production, Preview, and Development as appropriate.
6. Deploy the application.
7. Add the production URL to Supabase's Site URL and allowed redirect URLs.

**Public application:** https://www.edithx1.vercel.app

Redeploy after changing environment variables so the new values are available to both the client build and server runtime. A successful build alone does not confirm that authentication or AI chat works. Test that a fresh browser can open EDITH and send an authenticated chat request after deployment.

## 7. Multi-user deployment considerations

- Each deployment uses its own Supabase project and provider credentials.
- Users receive a Supabase anonymous session automatically. No EDITH site password or password-based login is required.
- Anonymous sessions provide per-browser identity; they are not verified personal accounts. Configure Row Level Security to prevent cross-user data access.
- Review Supabase Row Level Security policies before enabling public registration. User-owned records must be isolated by authenticated user ID.
- Configure provider usage limits and monitor Groq quotas. Multiple API keys are failover configuration, not a way to bypass provider limits or terms.
- The shared Edith Network key is used by server-side network tools for all users of this deployment. Monitor its usage and provider limits.
- Never expose server credentials in client-side code or public logs.

## Troubleshooting

**Missing Supabase environment variables:** verify the spelling of server variables and the matching `VITE_` variables. Restart the development server after editing `.env`.

**AI is not configured:** add `GROQ_API_KEY_1` or `GROQ_API_KEY` to the server environment and restart or redeploy.

**Edith Network unavailable:** verify that `STYX_NETWORK_API_KEY` is configured in the server environment and that the network service is online.

**Invalid Groq key:** replace it with a valid Groq API key from Groq Console, then redeploy. Do not paste the key into issue reports or screenshots.

**Authentication or redirect errors:** check that the Supabase URL and publishable key belong to the same project, the desired auth provider is enabled, and the local/production URLs are allowed.

**Dependency or build errors:** use the package manager matching the lockfile, reinstall dependencies if needed, and rerun lint, tests, and build.

## More documentation

- [AI engine](docs/AI_ENGINE.md)
- [Environment configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [License](LICENSE)
