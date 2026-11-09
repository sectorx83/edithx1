# Roadmap

This roadmap reflects the current repository implementation. A checked item means the corresponding code path exists; it does not mean that every production deployment or external integration has been independently verified.

## Implemented in the current codebase

- [x] Use Groq's OpenAI-compatible Chat Completions API for server-side chat.
- [x] Support configurable Groq model selection through `GROQ_MODEL`.
- [x] Support a configurable pool of Groq API keys and fail over on quota/billing or credential errors.
- [x] Validate chat requests through Supabase authentication middleware.
- [x] Create per-browser Supabase anonymous sessions instead of requiring a site password.
- [x] Bound chat history before sending it to the AI provider.
- [x] Run Whisper-based voice recognition in a browser worker and use local browser speech synthesis for playback.
- [x] Provide EDITH NETWORK command execution through the server-side integration.

## Verification and maintenance

- [ ] Run the full lint, Vitest, and production-build checks on the current main branch.
- [ ] Verify Supabase schema setup and Row Level Security policies in a clean project.
- [ ] Exercise Groq key failover with controlled test credentials and provider responses.
- [ ] Verify EDITH NETWORK behavior with a valid deployment credential and confirm failure handling when the service is unavailable.
- [ ] Test anonymous-session creation, refresh, and user-data isolation in a fresh browser.

## Documentation policy

Update this file when implementation status changes. Do not mark an item complete solely because it is planned, documented, or present in a UI; verify the corresponding code path first.
