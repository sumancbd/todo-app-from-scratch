const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { beforeEach } = require("node:test");
const { getTodos, resetTodos, resolvePort } = require("../server");
const { initializeHomepage, initializeTodoToggle } = require("../public/homepage");

async function makeRequest(pathname, options = {}) {
  const { app } = require("../server");
  const server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

beforeEach(() => {
  resetTodos();
});

test("GET / renders the todo page with an empty state", async () => {
  const response = await makeRequest("/");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
  assert.match(body, /Simple Todo App/i);
  assert.match(body, /Create a new todo/i);
  assert.match(body, /You do not have any todos yet\./i);
  assert.match(body, /Single-server todo flow/i);
  assert.doesNotMatch(body, /fullstack/i);
  assert.match(body, /<form[^>]+action="\/todos"/i);
  assert.match(body, /<link[^>]+href="\/styles\.css"/i);
  assert.doesNotMatch(body, /<a[^>]+href="\/health"/i);
  assert.match(body, /<button[^>]+type="button"[^>]*>Check health<\/button>/i);
  assert.match(body, /data-health-status/i);
  assert.match(body, /<script[^>]+src="\/homepage\.js"/i);
});

test("POST /todos creates a todo and redirects to the homepage", async () => {
  const response = await makeRequest("/todos", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "todo=Buy%20milk",
    redirect: "manual",
  });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/");
});

test("GET / renders created todos", async () => {
  await makeRequest("/todos", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "todo=Buy%20milk",
  });

  const response = await makeRequest("/");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /Buy milk/i);
  assert.doesNotMatch(body, /You do not have any todos yet\./i);
});

test("GET / shows the items-left counter after creating a todo", async () => {
  await makeRequest("/todos", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "todo=Buy%20groceries",
  });

  const response = await makeRequest("/");
  const body = await response.text();

  assert.match(body, /1 item left/i);
});

test("POST /todos/:id/toggle marks a todo completed and reduces items left", async () => {
  await makeRequest("/todos", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "todo=Buy%20milk",
  });

  const [todo] = getTodos();

  const toggleResponse = await makeRequest(`/todos/${todo.id}/toggle`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "",
    redirect: "manual",
  });

  assert.equal(toggleResponse.status, 302);

  const response = await makeRequest("/");
  const body = await response.text();

  assert.match(body, /0 items left/i);
  assert.match(
    body,
    /data-completed="true"[^]*?Buy milk/i,
  );
});

test("GET /?filter=active hides completed todos while the default view keeps showing them", async () => {
  await makeRequest("/todos", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "todo=Completed%20todo",
  });

  const [todo] = getTodos();

  await makeRequest(`/todos/${todo.id}/toggle`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "",
  });

  const allResponse = await makeRequest("/");
  const allBody = await allResponse.text();

  assert.match(allBody, /Completed todo/i);

  const activeResponse = await makeRequest("/?filter=active");
  const activeBody = await activeResponse.text();

  assert.doesNotMatch(activeBody, /Completed todo/i);
  assert.match(activeBody, /You do not have any active todos\./i);
});

test("POST /todos with blank content shows a validation error", async () => {
  const response = await makeRequest("/todos", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "todo=%20%20%20",
  });
  const body = await response.text();

  assert.equal(response.status, 400);
  assert.match(body, /Please enter a todo before saving\./i);
  assert.match(body, /You do not have any todos yet\./i);
});

test("GET /styles.css serves the stylesheet asset", async () => {
  const response = await makeRequest("/styles.css");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/css/i);
  assert.match(body, /body\s*\{/i);
});

test("project docs and package metadata avoid the old fullstack wording", () => {
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
  );

  assert.match(readme, /Express and EJS todo app\./);
  assert.doesNotMatch(readme, /fullstack/i);
  assert.equal(packageJson.description, "Express and EJS todo app.");
});

function createElement(initialText = "") {
  return {
    dataset: {},
    textContent: initialText,
    disabled: false,
    attributes: {},
    listeners: new Map(),
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener(eventName, listener) {
      this.listeners.set(eventName, listener);
    },
    async click() {
      const listener = this.listeners.get("click");

      if (listener) {
        await listener();
      }
    },
  };
}

function createHomePageEnvironment(overrides = {}) {
  const button = createElement("Check health");
  const status = createElement("Health status will appear here.");
  const toggle = createElement();
  const label = createElement("Dark mode");
  const root = {
    dataset: {},
    style: {},
  };
  const fetchCalls = [];
  const timeoutEntries = [];

  const environment = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
    matchMedia: () => ({ matches: false }),
    document: {
      documentElement: root,
      querySelector(selector) {
        if (selector === ".theme-toggle") {
          return toggle;
        }

        if (selector === ".theme-toggle__label") {
          return label;
        }

        if (selector === "[data-health-button]") {
          return button;
        }

        if (selector === "[data-health-status]") {
          return status;
        }

        return null;
      },
    },
    fetch: async (url, options) => {
      fetchCalls.push({ url, options });

      return {
        ok: true,
        async json() {
          return { status: "ok" };
        },
      };
    },
    AbortController: class AbortController {
      constructor() {
        this.signal = {};
      }

      abort() {
        this.signal.aborted = true;
      }
    },
    setTimeout(callback, delay) {
      const entry = { callback, delay };
      timeoutEntries.push(entry);
      return entry;
    },
    clearTimeout(timerId) {
      const timerIndex = timeoutEntries.indexOf(timerId);

      if (timerIndex >= 0) {
        timeoutEntries.splice(timerIndex, 1);
      }
    },
    ...overrides,
  };

  return {
    environment,
    button,
    status,
    label,
    root,
    fetchCalls,
    timeoutEntries,
  };
}

function createTodoToggleElement() {
  return {
    listeners: new Map(),
    addEventListener(eventName, listener) {
      this.listeners.set(eventName, listener);
    },
    change() {
      const listener = this.listeners.get("change");

      if (listener) {
        listener();
      }
    },
  };
}

test("initializeTodoToggle submits a todo's form when its checkbox changes", () => {
  const checkbox = createTodoToggleElement();
  const submitCalls = [];
  const form = {
    querySelector: (selector) => (selector === ".todo-toggle" ? checkbox : null),
    requestSubmit: () => submitCalls.push(true),
  };
  const environment = {
    document: {
      querySelectorAll: (selector) =>
        selector === "[data-todo-toggle-form]" ? [form] : [],
    },
  };

  initializeTodoToggle(environment);
  checkbox.change();

  assert.equal(submitCalls.length, 1);
});

test("initializeHomepage waits for a click before checking health", () => {
  const { environment, fetchCalls, status } = createHomePageEnvironment();

  initializeHomepage(environment);

  assert.equal(fetchCalls.length, 0);
  assert.equal(status.textContent, "Health status will appear here.");
});

test("initializeHomepage shows backend status after a successful health check", async () => {
  const { environment, button, status, fetchCalls, timeoutEntries } =
    createHomePageEnvironment();

  initializeHomepage(environment);
  await button.click();

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "/health");
  assert.equal(status.dataset.state, "success");
  assert.equal(status.textContent, "Healthy");
  assert.equal(button.disabled, false);
  assert.equal(timeoutEntries.length, 0);
});

test("initializeHomepage shows unhealthy status when the backend result is not ok", async () => {
  const { environment, button, status } = createHomePageEnvironment({
    fetch: async () => ({
      ok: true,
      async json() {
        return { status: "degraded" };
      },
    }),
  });

  initializeHomepage(environment);
  await button.click();

  assert.equal(status.dataset.state, "error");
  assert.equal(status.textContent, "Unhealthy");
  assert.equal(button.disabled, false);
});

test("initializeHomepage restores the UI when the health check times out", async () => {
  let abortSignal;
  const { environment, button, status, fetchCalls, timeoutEntries } =
    createHomePageEnvironment({
      fetch: async (url, options) => {
        fetchCalls.push({ url, options });
        abortSignal = options.signal;

        return new Promise((_resolve, reject) => {
          abortSignal.onabort = () => {
            const error = new Error("The operation was aborted.");
            error.name = "AbortError";
            reject(error);
          };
        });
      },
      AbortController: class AbortController {
        constructor() {
          this.signal = { aborted: false, onabort: null };
        }

        abort() {
          this.signal.aborted = true;

          if (typeof this.signal.onabort === "function") {
            this.signal.onabort();
          }
        }
      },
    });

  initializeHomepage(environment);
  const clickPromise = button.click();

  assert.equal(status.dataset.state, "loading");
  assert.equal(button.disabled, true);
  assert.equal(timeoutEntries.length, 1);

  timeoutEntries[0].callback();
  await clickPromise;

  assert.equal(fetchCalls.length, 1);
  assert.equal(abortSignal.aborted, true);
  assert.equal(status.dataset.state, "error");
  assert.equal(status.textContent, "Unhealthy");
  assert.equal(button.disabled, false);
  assert.equal(timeoutEntries.length, 0);
});

test("GET /health returns ok status", async () => {
  const response = await makeRequest("/health");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
});

test("resolvePort falls back to 3000 when PORT is missing", () => {
  assert.equal(resolvePort(undefined), 3000);
});

test("resolvePort falls back to 3000 when PORT is non-numeric", () => {
  assert.equal(resolvePort("abc"), 3000);
});

test("resolvePort falls back to 3000 when PORT has malformed numeric prefixes", () => {
  assert.equal(resolvePort("123abc"), 3000);
  assert.equal(resolvePort("1e3"), 3000);
  assert.equal(resolvePort("0x10"), 3000);
});

test("resolvePort falls back to 3000 when PORT is out of range", () => {
  assert.equal(resolvePort("0"), 3000);
  assert.equal(resolvePort("65536"), 3000);
});

test("resolvePort returns numeric PORT values in range", () => {
  assert.equal(resolvePort("3001"), 3001);
  assert.equal(resolvePort(" 3002 "), 3002);
});
