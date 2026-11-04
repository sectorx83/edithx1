# Repository guidance

- Chat uses the server-only Groq client in `src/lib/ai.server.ts`. Keep all provider credentials server-side.
- Configure Groq with `GROQ_API_KEY_1` through `GROQ_API_KEY_4`, or the single-key fallback `GROQ_API_KEY`. `GROQ_MODEL` optionally overrides the default model.
- The chat server function in `src/lib/jarvis.functions.ts` owns safe, user-facing AI error messages and EDITH NETWORK directive execution.
- Voice recognition runs Whisper in a browser worker and playback selects only local speech-synthesis voices. Voice capture/playback does not call a paid AI voice service.
- Use the setup guide in `SETUP.md` as the source of truth for local and production configuration.
- Never commit real environment files, API keys, service-role credentials, access tokens, or user data.
