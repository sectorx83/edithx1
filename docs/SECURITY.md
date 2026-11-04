# Security notes

- Keep Groq API keys on the server. Never prefix them with `VITE_` and never return them from a server function.
- Use Supabase publishable keys only in browser-visible configuration. Secret/service-role keys must remain server-side.
- Keep chat behind the existing Supabase authentication middleware.
- Do not log API keys, authorization headers, raw provider response bodies, or private user content.
- Do not commit `.env`, local credentials, tokens, or production data.
- Rotate any credential that has been committed to a public repository or otherwise exposed. Adding a file to `.gitignore` does not remove it from Git history.
- Treat EDITH NETWORK directives as untrusted model output. Validate commands and arguments in the network execution layer before performing external actions.
