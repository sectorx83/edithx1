# Architecture overview

## Application

EDITH X1 is a React and TypeScript web application built with TanStack Start and Vite. Supabase provides authentication and application data. Groq provides server-side text generation.

## Chat request path

```text
Browser chat
  -> authenticated askJarvis server function
  -> assistant system prompt + EDITH NETWORK instructions
  -> server-only callChat
  -> Groq Chat Completions API
  -> assistant response
  -> optional EDITH NETWORK directive execution
  -> browser
```

The authenticated server function limits submitted history to the latest 20 messages and each message to 4,000 characters before calling the provider.

## AI provider boundary

`src/lib/ai.server.ts` owns provider communication, key selection, timeout handling, failover, and normalized errors. It must remain server-only. UI components should call the existing server function rather than importing provider code or reading API credentials.

## Authentication and data

Supabase authentication is validated in the server middleware. Browser sessions persist in the browser's local storage; server-side requests validate bearer tokens and use the configured Supabase URL and publishable key.

## Voice

Voice recognition runs Whisper in a browser worker. Speech playback uses the browser's local speech-synthesis voices. This voice path is separate from the Groq text-chat request path.

## EDITH NETWORK

The assistant may return one `[STYX_CMD]` directive. The server function parses that directive and delegates it to `sendNetworkCommand` in the network server module. The directive contract is defined in `src/lib/jarvis.functions.ts`.
