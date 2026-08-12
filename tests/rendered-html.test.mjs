import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Desi Kitchen landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Desi Kitchen \| Wholesale Ordering<\/title>/i);
  assert.match(html, /desi-kitchen-logo\.png/);
  assert.match(html, /Log in to sales workspace/);
  assert.match(html, /Customer access/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps customer prices private on the public landing page", async () => {
  const html = await (await render()).text();
  assert.match(html, /No account or password needed/);
  assert.doesNotMatch(html, /\$\d+\.\d{2}/);
});
