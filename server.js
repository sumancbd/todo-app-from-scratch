const path = require("node:path");

const express = require("express");

const app = express();
const publicDir = path.join(__dirname, "public");
const viewsDir = path.join(__dirname, "views");
const DEFAULT_PORT = 3000;
const todos = [];
let nextTodoId = 1;

function resolvePort(portValue) {
  if (portValue === undefined) {
    return DEFAULT_PORT;
  }

  const normalizedPortValue = String(portValue).trim();

  if (!/^\d+$/.test(normalizedPortValue)) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(normalizedPortValue, 10);

  if (
    Number.isNaN(parsedPort) ||
    parsedPort < 1 ||
    parsedPort > 65535
  ) {
    return DEFAULT_PORT;
  }

  return parsedPort;
}

function normalizeTodoText(todoValue) {
  return typeof todoValue === "string" ? todoValue.trim() : "";
}

function createTodo(todoText) {
  const todo = {
    id: nextTodoId,
    text: todoText,
  };

  nextTodoId += 1;
  todos.push(todo);

  return todo;
}

function getTodos() {
  return [...todos];
}

function resetTodos() {
  todos.length = 0;
  nextTodoId = 1;
}

function renderHomepage(response, viewModel = {}) {
  response.render("index", {
    title: "Simple Todo App",
    todos: getTodos(),
    formError: "",
    todoValue: "",
    ...viewModel,
  });
}

const port = resolvePort(process.env.PORT);

app.set("view engine", "ejs");
app.set("views", viewsDir);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

app.get("/", (_request, response) => {
  renderHomepage(response);
});

app.post("/todos", (request, response) => {
  const todoValue = typeof request.body?.todo === "string"
    ? request.body.todo
    : "";
  const todoText = normalizeTodoText(todoValue);

  if (!todoText) {
    response.status(400);
    renderHomepage(response, {
      formError: "Please enter a todo before saving.",
      todoValue,
    });
    return;
  }

  createTodo(todoText);
  response.redirect("/");
});

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

module.exports = {
  app,
  createTodo,
  getTodos,
  normalizeTodoText,
  resetTodos,
  resolvePort,
};
