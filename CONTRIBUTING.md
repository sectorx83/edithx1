# Contributing

## Development setup

Follow [SETUP.md](SETUP.md) to install dependencies, configure environment variables, and run the application locally.

## Before submitting changes

Run the relevant checks:

```sh
bun run lint
bun test
bun run build
```

Keep changes focused, preserve published Git history, and do not commit generated secrets or real environment files.

## AI changes

Keep provider calls in the server-only AI module. Preserve normalized public errors, bounded request timeouts, and server-side credential handling. Update the AI engine documentation when provider configuration or request behavior changes.
