# Architecture overview

## Application

The project is a React and TypeScript web application built with TanStack Start and Vite. Supabase provides authentication and application data. Lovable is connected to the Git repository for the hosted editing workflow.

## Chat request path

```text
Browser chat
  -> authenticated askJarvis server function
  -> buildSystemPrompt + EDITH NETWORK instructions
  -> server-only callChat
  -> Groq Chat Completions API
  -> assistant response
  -> optional EDITH NETWORK directive execution
  -> browser
```

The authenticated server function limits the submitted history to the latest 20 messages and each message to 4,000 characters before calling the provider.

## AI provider boundary

`src/lib/ai.server.ts` owns provider communication, key selection, timeout handling, failover, and normalized errors. It must remain server-only. UI components should call the existing server function rather than importing provider code or reading API credentials.

## Voice

Voice recognition runs Whisper in a browser worker. Speech playback uses the browser's local speech-synthesis voices. This voice path is separate from the Groq text-chat request path.

## EDITH NETWORK

The assistant may return one `[STYX_CMD]` directive. The server function parses that directive and delegates it to `sendNetworkCommand` in the network server module. The directive contract is defined in `src/lib/jarvis.functions.ts`.
