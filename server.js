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
    completed: false,
  };

  nextTodoId += 1;
  todos.push(todo);

  return todo;
}

function getTodos({ filter } = {}) {
  if (filter === "active") {
    return todos.filter((todo) => !todo.completed);
  }

  if (filter === "completed") {
    return todos.filter((todo) => todo.completed);
  }

  return [...todos];
}

function getItemsLeftCount() {
  return todos.filter((todo) => !todo.completed).length;
}

function hasCompletedTodos() {
  return todos.some((todo) => todo.completed);
}

function toggleTodo(id) {
  const todo = todos.find((candidateTodo) => candidateTodo.id === id);

  if (!todo) {
    return undefined;
  }

  todo.completed = !todo.completed;

  return todo;
}

function resetTodos() {
  todos.length = 0;
  nextTodoId = 1;
}

function clearCompletedTodos() {
  for (let index = todos.length - 1; index >= 0; index -= 1) {
    if (todos[index].completed) {
      todos.splice(index, 1);
    }
  }
}

function normalizeFilter(filterValue) {
  if (filterValue === "active" || filterValue === "completed") {
    return filterValue;
  }

  return "all";
}

function filterRedirectPath(filter) {
  return filter === "all" ? "/" : `/?filter=${filter}`;
}

function renderHomepage(response, viewModel = {}) {
  const filter = normalizeFilter(viewModel.filter);

  response.render("index", {
    title: "Simple Todo App",
    todos: getTodos({ filter }),
    itemsLeft: getItemsLeftCount(),
    hasCompletedTodos: hasCompletedTodos(),
    formError: "",
    todoValue: "",
    ...viewModel,
    filter,
  });
}

const port = resolvePort(process.env.PORT);

app.set("view engine", "ejs");
app.set("views", viewsDir);

app.use(express.urlencoded({ extended: false }));
app.use(express.static(publicDir));

app.get("/", (request, response) => {
  renderHomepage(response, { filter: request.query?.filter });
});

app.post("/todos", (request, response) => {
  const todoValue = typeof request.body?.todo === "string"
    ? request.body.todo
    : "";
  const todoText = normalizeTodoText(todoValue);
  const filter = normalizeFilter(request.body?.filter);

  if (!todoText) {
    response.status(400);
    renderHomepage(response, {
      formError: "Please enter a todo before saving.",
      todoValue,
      filter,
    });
    return;
  }

  createTodo(todoText);
  response.redirect(filterRedirectPath(filter));
});

app.post("/todos/:id/toggle", (request, response) => {
  const todoId = Number.parseInt(request.params.id, 10);
  const filter = normalizeFilter(request.body?.filter);

  toggleTodo(todoId);
  response.redirect(filterRedirectPath(filter));
});

app.post("/todos/clear-completed", (request, response) => {
  const filter = normalizeFilter(request.body?.filter);

  clearCompletedTodos();
  response.redirect(filterRedirectPath(filter));
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
  clearCompletedTodos,
  createTodo,
  getItemsLeftCount,
  getTodos,
  hasCompletedTodos,
  normalizeTodoText,
  resetTodos,
  resolvePort,
  toggleTodo,
};
