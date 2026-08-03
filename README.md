# todo-app-from-scratch

Express and EJS todo app. The project uses a single Node server to render an
EJS frontend, handle todo form submissions, and serve static assets from the
same repository.

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
│   ├── homepage.js
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
- Todo creation uses a standard HTML form posting to `POST /todos`.
- Todos are stored in memory only and reset whenever the server restarts.
- Static assets are served by Express from `public/`.
- The health check endpoint is available at `GET /health`.
