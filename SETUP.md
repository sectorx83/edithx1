# EDITH X1 Setup Guide

This guide explains how to install, configure, run, test, and deploy EDITH X1. The application supports multiple users. Each deployment operator supplies and manages their own Supabase project and provider credentials.

## Requirements

- Git
- Node.js 22 or later
- Bun (recommended; the repository includes `bun.lock`)
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

Create a project at https://supabase.com/dashboard. From the project's API settings, obtain its project URL and publishable key (a legacy anon/public key is also supported).

Enable **Anonymous Sign-Ins** in Supabase Authentication. EDITH creates a Supabase anonymous session for each browser; it does not currently provide password-based site login.

The application expects the Supabase schema used by its current source code, including the `user_settings` table queried by the chat server function. Apply the schema/migrations supplied with the repository when present, and verify the required tables and Row Level Security policies in your own Supabase project before opening the deployment to users. Do not assume that creating a Supabase project alone provisions the application's schema.

## 3. Configure environment variables

Create a local environment file:

```sh
cp .env.example .env
```

### Required server variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL used by server-side code. |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; a legacy anon/public key is also accepted. |
| `GROQ_API_KEY_1` or `GROQ_API_KEY` | At least one Groq key is required for AI chat. |

### Browser-visible Supabase variables

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL exposed to the browser build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key exposed to the browser build. |

These public values must point to the same Supabase project as the server variables.

### Optional server variables

| Variable | Purpose |
| --- | --- |
| `STYX_NETWORK_API_KEY` | Legacy-named server credential used by the EDITH NETWORK integration. Needed only when using network tools. |
| `GROQ_API_KEY_2` through `GROQ_API_KEY_4` | Additional Groq keys used for configured key failover. |
| `GROQ_MODEL` | Groq model ID; defaults to `openai/gpt-oss-120b`. |
| `SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PROJECT_ID` | Optional project identifiers for integrations that need them; not required by the core chat path. |

Create a Groq key at https://console.groq.com/keys. The current code reads Groq keys in this order: `GROQ_API_KEY_1` through `GROQ_API_KEY_4`, followed by `GROQ_API_KEY`. Blank and duplicate values are ignored.

**Network credential compatibility note:** the network integration is presented in the app as EDITH NETWORK, but the current server implementation still reads the environment variable named `STYX_NETWORK_API_KEY`. Set that exact variable if you enable network tools. This is a legacy configuration name, not a separate user-facing product or a public API name. Renaming it requires a coordinated source-code change.

**Security:** variables prefixed with `VITE_` are exposed in the browser bundle. Only public Supabase project values belong there. Never put Groq keys, the network credential, Supabase secret/service-role keys, database passwords, or other private credentials in `VITE_*` variables. Keep `.env` private; it is ignored by Git.

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

Run the package scripts before submitting changes or deploying:

```sh
bun run lint
bun run test
bun run build
```

The equivalent npm commands are `npm run lint`, `npm test`, and `npm run build`. The test script runs Vitest.

To preview a production build locally, run `bun run build` and then `bun run preview`.

## 6. Deploy to Vercel

1. Import this GitHub repository into your Vercel account.
2. Set the project root to the repository root.
3. Use the detected TanStack Start/Vite settings or set the build command to `bun run build`.
4. Add the required Supabase and Groq variables from section 3 in **Project Settings → Environment Variables**.
5. Add the optional network credential only if the EDITH NETWORK integration is enabled.
6. Select the environments that need each variable (Production, Preview, and Development).
7. Deploy the application.
8. Add the production URL to Supabase's Site URL and allowed redirect URLs.

**Public application:** https://www.edithx1.vercel.app

Redeploy after changing environment variables so the new values are available to both the client build and server runtime. A successful build alone does not confirm that authentication, database access, or AI chat works. Test a fresh browser session, send a chat request, and verify user-data isolation.

## 7. Multi-user deployment considerations

- Each deployment uses its own Supabase project and provider credentials.
- Users receive a Supabase anonymous session automatically. No EDITH site password or password-based login is currently implemented.
- Anonymous sessions provide per-browser identity; they are not verified personal accounts and can be lost when browser storage is cleared.
- Configure and test Row Level Security so user-owned records are isolated by authenticated user ID. Do not expose tables with user data under permissive policies.
- Configure provider usage limits and monitor Groq quotas. Multiple API keys provide configured failover; they are not a way to bypass provider limits or terms.
- The EDITH NETWORK credential is shared by all users of a deployment. Enable the integration only when appropriate, and monitor its usage and provider limits.
- Never expose server credentials in client-side code, browser logs, screenshots, or public issue reports.

## Troubleshooting

**Missing Supabase environment variables:** verify the spelling of server variables and the matching `VITE_` variables. Restart the development server after editing `.env`.

**AI is not configured:** add `GROQ_API_KEY_1` or `GROQ_API_KEY` to the server environment and restart or redeploy.

**EDITH NETWORK unavailable:** verify that `STYX_NETWORK_API_KEY` is configured in the server environment and that the external network service is reachable. This variable retains a legacy name in the current source.

**Invalid Groq key:** replace it with a valid Groq API key from Groq Console, then redeploy. Do not paste the key into issue reports or screenshots.

**Authentication or redirect errors:** check that the Supabase URL and publishable key belong to the same project, Anonymous Sign-Ins are enabled, and the local/production URLs are allowed.

**Database permission errors:** inspect the required schema and Row Level Security policies in Supabase. A valid anonymous session does not automatically grant access to application tables.

**Dependency or build errors:** use the package manager matching the lockfile, reinstall dependencies if needed, and rerun lint, tests, and build.

## More documentation

- [AI engine](docs/AI_ENGINE.md)
- [Environment configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](roadmap.md)
- [License](LICENSE)
