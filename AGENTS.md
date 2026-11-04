<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Chat uses the server-only Groq client in `src/lib/ai.server.ts`. Keep all provider credentials server-side.
- Configure Groq with `GROQ_API_KEY_1` through `GROQ_API_KEY_4`, or the single-key fallback `GROQ_API_KEY`. `GROQ_MODEL` optionally overrides the default model.
- The chat server function in `src/lib/jarvis.functions.ts` owns safe, user-facing AI error messages and the EDITH NETWORK directive execution.
- Voice recognition runs Whisper in a browser worker and playback selects only local speech-synthesis voices. Voice capture/playback does not call a paid AI voice service.
- Never commit real environment files, API keys, service-role credentials, access tokens, or user data.
