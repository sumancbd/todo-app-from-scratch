const path = require("node:path");

const express = require("express");

const app = express();
const publicDir = path.join(__dirname, "public");
const viewsDir = path.join(__dirname, "views");
const port = Number.parseInt(process.env.PORT ?? "3000", 10);

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

module.exports = { app };
