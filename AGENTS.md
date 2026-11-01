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

- Chat uses a server-only Gemini key pool with quota/credential failover and generic public failures; no other AI provider is permitted.
- Voice recognition runs Whisper in a browser worker and playback selects only local speech-synthesis voices, so voice never calls a paid AI service.
