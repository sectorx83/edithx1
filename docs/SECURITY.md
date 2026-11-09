# Security notes

## Secrets and server boundaries

- Keep Groq API keys and the EDITH NETWORK credential in server-side environment variables. Never prefix them with `VITE_`, return them from server functions, or include them in browser bundles.
- The current network integration reads the legacy variable name `STYX_NETWORK_API_KEY`. Treat its value as a secret even though the variable name is retained for compatibility.
- Use Supabase publishable keys only in browser-visible configuration. Supabase secret/service-role keys must remain server-side and are not needed by the documented client setup.
- Never log API keys, authorization headers, raw provider response bodies, or private user content.
- Do not commit `.env`, local credentials, tokens, production data, or private user information.
- Rotate any credential that has been committed to a public repository or otherwise exposed. Adding a file to `.gitignore` does not remove it from Git history.

## Authentication and data isolation

- Keep chat behind the existing Supabase authentication middleware.
- Anonymous authentication identifies a browser session; it does not prove a real-world identity or provide password-based account recovery.
- Configure and test Row Level Security policies for every table containing user-owned data. Policies should scope reads and writes to the authenticated user ID where appropriate.
- Do not assume that enabling anonymous sign-in automatically makes database access safe.

## External actions and AI output

- Treat EDITH NETWORK commands and arguments as untrusted model output.
- Keep an explicit command allowlist and validate/sanitize arguments in the server-side execution layer before performing external actions.
- Keep external service credentials on the server and monitor usage because the deployment credential is shared across app users.
- Do not treat generated text as authorization for privileged actions. Add independent authorization checks for any future sensitive operation.
