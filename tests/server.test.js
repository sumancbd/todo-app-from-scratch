const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePort } = require("../server");
const { initializeHomepage } = require("../public/homepage");

async function makeRequest(pathname) {
  const { app } = require("../server");
  const server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const { port } = server.address();

  try {
    return await fetch(`http://127.0.0.1:${port}${pathname}`);
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

test("GET / returns the starter page", async () => {
  const response = await makeRequest("/");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
  assert.match(body, /Express and EJS Starter/i);
  assert.match(body, /Simple Todo App/i);
  assert.match(body, /<link[^>]+href="\/styles\.css"/i);
  assert.doesNotMatch(body, /<a[^>]+href="\/health"/i);
  assert.match(body, /<button[^>]+type="button"[^>]*>Check health<\/button>/i);
  assert.match(body, /data-health-status/i);
  assert.match(body, /<script[^>]+src="\/homepage\.js"/i);
});

test("GET /styles.css serves the stylesheet asset", async () => {
  const response = await makeRequest("/styles.css");
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /text\/css/i);
  assert.match(body, /body\s*\{/i);
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
