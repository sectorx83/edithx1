# Contributing

## Development setup

Follow [SETUP.md](SETUP.md) to install dependencies, configure environment variables, and run the application locally.

## Before submitting changes

Run the repository's package scripts:

```sh
bun run lint
bun run test
bun run build
```

The test command runs Vitest through the `test` script in `package.json`. With npm, use `npm run lint`, `npm test`, and `npm run build`.

Keep changes focused, preserve published Git history, and do not commit generated secrets, real environment files, production data, or private user information.

## AI changes

Keep provider calls in the server-only AI module. Preserve bounded request timeouts, configured key failover, normalized public errors, and server-side credential handling. Update [the AI engine documentation](docs/AI_ENGINE.md) whenever provider configuration or request behavior changes.

## Network integration changes

Keep network credentials in server-only code. Validate model-generated commands and arguments before executing external actions. Update [the configuration guide](docs/CONFIGURATION.md), [the architecture overview](docs/ARCHITECTURE.md), and the setup guide whenever the network integration's environment variables or behavior changes.
