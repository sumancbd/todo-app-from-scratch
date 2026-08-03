# todo-app-from-scratch

Minimal Express-based fullstack scaffold for a simple todo app. The project
uses a single Node server to render an EJS frontend and serve static assets
from the same repository.

## Requirements

- Node.js 24+
- pnpm 11+

## Getting Started

```bash
pnpm install
pnpm dev
```

The app runs at `http://localhost:3000` by default.

## Available Scripts

- `pnpm dev` starts the Express server with `nodemon`
- `pnpm start` starts the Express server
- `pnpm test` runs the Node test suite
- `pnpm lint` runs ESLint

## Project Structure

```text
.
├── public/
│   └── styles.css
├── tests/
│   └── server.test.js
├── views/
│   └── index.ejs
├── eslint.config.js
├── package.json
└── server.js
```

## Notes

- Express renders the homepage from `views/index.ejs`.
- Static assets are served by Express from `public/`.
- The starter page includes a minimal CSS fade-in/hover animation baseline.
- The health check endpoint is available at `GET /health`.
