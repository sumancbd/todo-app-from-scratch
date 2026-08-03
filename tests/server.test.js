const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePort } = require("../server");

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
