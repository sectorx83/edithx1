# Contributing

## Setup

1. Install a supported Node.js version and npm.
2. Clone the repository and run `npm install`.
3. Copy `.env.example` to `.env` and fill in the required local values.
4. Start the development server with `npm run dev`.

## Before submitting changes

Run the relevant checks:

```sh
npm run lint
npm test
npm run build
```

Keep changes focused, preserve the Lovable-connected Git history, and do not commit generated secrets or real environment files.

## AI changes

Keep provider calls in the server-only AI module. Preserve normalized public errors, bounded request timeouts, and server-side credential handling. Update the AI engine documentation when provider configuration or request behavior changes.
