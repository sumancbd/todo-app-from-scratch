const path = require("node:path");

const express = require("express");

const app = express();
const publicDir = path.join(__dirname, "public");
const viewsDir = path.join(__dirname, "views");
const DEFAULT_PORT = 3000;

function resolvePort(portValue) {
  if (portValue === undefined) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(String(portValue), 10);

  if (
    Number.isNaN(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65535
  ) {
    return DEFAULT_PORT;
  }

  return parsedPort;
}

const port = resolvePort(process.env.PORT);

app.set("view engine", "ejs");
app.set("views", viewsDir);

app.use(express.static(publicDir));

app.get("/", (_request, response) => {
  response.render("index", {
    title: "Simple Todo App",
  });
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = { app, resolvePort };
