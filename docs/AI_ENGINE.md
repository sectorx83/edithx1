# AI engine

## Provider and model

EDITH chat uses Groq's OpenAI-compatible Chat Completions API:

`https://api.groq.com/openai/v1/chat/completions`

The default model is `openai/gpt-oss-120b`. Set `GROQ_MODEL` to another model enabled for the configured Groq account without changing application code.

## Request flow

1. The authenticated `askJarvis` server function receives the recent conversation.
2. It loads the user's assistant settings and builds the system prompt, including instructions for optional EDITH NETWORK actions.
3. The server-only `callChat` function sends the system prompt and conversation messages to Groq.
4. The server inspects the generated reply for an optional network command and executes it through the server-side integration when present.
5. The browser receives the assistant reply and any network result, never the provider API key or network credential.

The server accepts at most the latest 20 messages and truncates each message's content to 4,000 characters.

## API key rotation

Configure up to four keys using `GROQ_API_KEY_1` through `GROQ_API_KEY_4`. The optional `GROQ_API_KEY` is also included in the pool. Blank and duplicate values are ignored.

The client tries configured keys in order. It moves to the next key after HTTP 402/429 quota or billing responses and HTTP 401/403 credential responses. Other provider or network errors fail immediately instead of repeatedly sending the same request.

Key rotation is an availability mechanism for configured credentials. It does not bypass Groq account limits, billing requirements, or provider terms.

## Timeout and errors

Each provider request has a 20-second timeout. Public errors are normalized to these codes:

- `AI_NOT_CONFIGURED`
- `AI_BAD_API_KEY`
- `AI_RATE_LIMITED`
- `AI_TIMEOUT`
- `AI_PROVIDER_ERROR`

Unexpected provider responses, including empty assistant content, are normalized to `AI_PROVIDER_ERROR`. Logs contain only a safe failure category, never the API key or raw provider response body.

## Configuration

Set `GROQ_API_KEY_1` or `GROQ_API_KEY` in the server environment. Set `GROQ_MODEL` only when you want to override the default model. See [CONFIGURATION.md](CONFIGURATION.md).
