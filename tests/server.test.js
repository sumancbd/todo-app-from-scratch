const test = require("node:test");
const assert = require("node:assert/strict");

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
  assert.match(body, /Simple Todo App/i);
});

test("GET /health returns ok status", async () => {
  const response = await makeRequest("/health");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { status: "ok" });
});
