# AI engine

## Provider and model

EDITH chat uses Groq's OpenAI-compatible Chat Completions API:

`https://api.groq.com/openai/v1/chat/completions`

The default model is `openai/gpt-oss-120b`. Set `GROQ_MODEL` to another model enabled for the Groq account without changing application code.

## Request flow

1. The authenticated `askJarvis` server function receives the recent conversation.
2. It builds the assistant system prompt and appends the EDITH NETWORK tool-directive instructions.
3. The server-only `callChat` function sends a system message and conversation messages to Groq.
4. The server returns the generated text and, when present, processes the single EDITH NETWORK directive.
5. The browser receives the reply and network result, never the provider API key.

## API key rotation

Configure up to four keys using `GROQ_API_KEY_1` through `GROQ_API_KEY_4`. The optional `GROQ_API_KEY` is also included in the pool. Duplicate and blank values are ignored.

The client tries keys in order. It moves to the next key after HTTP 402/429 quota or billing responses and HTTP 401/403 credential responses. Other provider or network errors fail immediately instead of repeatedly sending the same request.

## Timeout and errors

Each request has a 20-second timeout. Public errors are normalized to these codes:

- `AI_NOT_CONFIGURED`
- `AI_BAD_API_KEY`
- `AI_RATE_LIMITED`
- `AI_TIMEOUT`
- `AI_PROVIDER_ERROR`

Logs contain only a safe failure category, never the API key or raw provider response body.

## Configuration

Set `GROQ_API_KEY_1` (or `GROQ_API_KEY`) in the server environment. Set `GROQ_MODEL` only when you want to override the default model. See [CONFIGURATION.md](CONFIGURATION.md).
