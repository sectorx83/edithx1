# Architecture overview

## Application

EDITH X1 is a React and TypeScript web application built with TanStack Start and Vite. Supabase provides authentication and application data. Groq provides server-side text generation.

## Chat request path

```text
Browser chat
  -> authenticated askJarvis server function
  -> load user settings and build assistant prompt
  -> server-only callChat
  -> Groq Chat Completions API
  -> inspect the assistant response for an optional EDITH NETWORK command
  -> execute an allowed network command on the server when present
  -> return the reply and any network result to the browser
```

The server function accepts the latest 20 conversation messages and truncates each message's content to 4,000 characters before sending the conversation to the provider.

## AI provider boundary

`src/lib/ai.server.ts` owns provider communication, key selection, timeout handling, failover, and normalized errors. It must remain server-only. UI components should call the existing server function rather than importing provider code or reading API credentials.

## Authentication and data

The chat server function uses Supabase authentication middleware. Browser sessions are created through Supabase anonymous authentication and persist in browser storage. Server-side requests validate the session through the configured Supabase client. Anonymous sessions identify a browser session; they are not verified personal accounts.

Application data access also depends on the database schema and Row Level Security policies configured in the deployment's Supabase project. Authentication alone does not guarantee that table policies isolate one user's data from another's.

## Voice

Voice recognition runs Whisper in a browser worker. Speech playback uses the browser's local speech-synthesis voices. This voice path is separate from the Groq text-chat request path.

## EDITH NETWORK

The assistant can request a limited set of network actions, including web search, page fetching, website opening, world-news dashboard access, and multi-step tasks. The server parses the internal command marker, validates the command against an allowlist, sanitizes supported arguments, and calls the external network service from server-only code.

The network integration is optional and uses a shared deployment credential. Its credential must never be sent to browser code. The implementation currently retains legacy internal filenames and a legacy environment-variable name; these are implementation details, not separate user-facing product names.
