# Setup and deployment

This guide covers a clean local installation and the environment required to run EDITH X1.

## 1. Prerequisites

- Git
- [Bun](https://bun.sh/) (the repository includes `bun.lock`)
- A Supabase project
- A Groq API key

Use a current stable Bun release and a supported Node.js LTS release for your operating system.

## 2. Clone the repository

```sh
git clone https://github.com/sectorx83/edithx1.git
cd edithx1
```

## 3. Install dependencies

```sh
bun install --frozen-lockfile
```

If Bun reports that the lockfile needs to be updated after dependency changes, run `bun install` and commit the resulting `bun.lock` update.

## 4. Configure environment variables

Create your local environment file:

```sh
cp .env.example .env
```

Set the following values in `.env`:

| Variable | Required | Description |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL used by server-side requests. |
| `SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key used by the server. |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL exposed to the browser build. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key exposed to the browser build. |
| `GROQ_API_KEY_1` | Yes | Primary Groq API key for chat. |
| `GROQ_API_KEY_2` to `GROQ_API_KEY_4` | No | Additional keys used for quota and credential failover. |
| `GROQ_API_KEY` | No | Single-key fallback or an additional key in the pool. |
| `GROQ_MODEL` | No | Groq model ID; defaults to `openai/gpt-oss-120b`. |
| `SUPABASE_PROJECT_ID` | No | Project identifier for local tooling that needs it. |
| `VITE_SUPABASE_PROJECT_ID` | No | Public project identifier for client-side tooling that needs it. |

At least one Groq key is required. You can set `GROQ_API_KEY` instead of `GROQ_API_KEY_1`.

**Security:** values with a `VITE_` prefix are embedded in the browser bundle. Only Supabase URL, publishable key, and other genuinely public values belong there. Never put Groq keys, service-role keys, database passwords, or other secrets in `VITE_*` variables.

Keep `.env` private. It is ignored by Git. Do not paste production credentials into issues, pull requests, screenshots, or source files.

## 5. Start the development server

```sh
bun run dev
```

Open the local URL printed by Vite in the terminal.

## 6. Quality checks

Run these before pushing changes:

```sh
bun run lint
bun test
bun run build
```

For a production-like local preview after building:

```sh
bun run preview
```

## 7. Deploy

The application can be deployed to a host that supports TanStack Start and the configured Nitro runtime.

1. Import the Git repository into your hosting provider.
2. Configure the six required variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and at least one Groq key (`GROQ_API_KEY_1` or `GROQ_API_KEY`).
3. Add optional Groq failover keys and `GROQ_MODEL` if needed.
4. Build using `bun run build`.
5. Deploy and inspect the build/runtime logs.
6. Redeploy whenever environment variables change.

Do not assume a deployment is healthy just because the build completed. Confirm that sign-in works and that an authenticated chat request receives a Groq response.

## 8. Troubleshooting

### Missing Supabase environment variables

Check that the server variables and the `VITE_` browser variables are all present. Restart the dev server after editing `.env`.

### AI is not configured

Set `GROQ_API_KEY_1` or `GROQ_API_KEY` in the server environment and restart or redeploy.

### Invalid Groq API key

Create or rotate the key in [Groq Console](https://console.groq.com/keys), update the server environment, and redeploy. Never expose the key in browser code.

### Chat is rate-limited

Check Groq account limits and billing. Configure additional keys only when they belong to accounts you are authorized to use.

### Authentication fails

Verify the Supabase URL and publishable key belong to the same Supabase project. Check the Supabase authentication configuration and server logs without sharing access tokens.

## Related documentation

- [AI engine](docs/AI_ENGINE.md)
- [Environment configuration](docs/CONFIGURATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security](docs/SECURITY.md)
