// NITRO_PRESET=vercel npm run build 후 실행하는 로컬 경로 검사입니다.
// 실제 Supabase·AI·폰트·Chromium 다운로드 요청은 발생하지 않습니다.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.SUPABASE_URL = "https://local-render-check.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "local-test-server-key";
process.env.IR_HTML_RENDER_SECRET =
  "local-render-route-test-secret-00000000000000000000000000000000";

const root = path.resolve(".vercel/output");
const serverPath = path.join(root, "functions/__server.func/_ssr/ssr.mjs");
const config = JSON.parse(
  await readFile(path.join(root, "functions/__server.func/.vc-config.json"), "utf8"),
);
assert.equal(config.maxDuration, 120);
assert.equal(config.memory, 2048);

const previousFetch = globalThis.fetch;
let externalRequests = 0;
globalThis.fetch = async () => {
  externalRequests++;
  throw new Error("Unexpected outbound request in route smoke check");
};
try {
  const { default: server } = await import(pathToFileURL(serverPath).href);
  const url = "https://local.test/api/internal/ir-html-render-v1";
  let response = await server.fetch(new Request(url), {}, {});
  assert.equal(response.status, 405);
  assert.equal((await response.json()).error_code, "METHOD_NOT_ALLOWED");

  response = await server.fetch(new Request(url, { method: "POST", body: "{}" }), {}, {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error_code, "SERVER_ONLY");

  response = await server.fetch(
    new Request(url, {
      method: "POST",
      headers: { "X-IR-Render-Secret": process.env.IR_HTML_RENDER_SECRET },
      body: "{}",
    }),
    {},
    {},
  );
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error_code, "INVALID_REQUEST");
  assert.equal(externalRequests, 0);
} finally {
  globalThis.fetch = previousFetch;
}

async function checkClient(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await checkClient(full);
    else if (entry.name.endsWith(".js")) {
      const text = await readFile(full, "utf8");
      for (const marker of [
        "IR_HTML_RENDER_SECRET",
        "chromium-v153.0.0-pack",
        "handleIrHtmlRender",
      ]) {
        assert.ok(!text.includes(marker), `Server renderer marker leaked into ${entry.name}`);
      }
    }
  }
}
await checkClient(path.join(root, "static"));
console.log(
  "PASS built IR renderer route: method/auth/input gates, runtime limits, no outbound calls, no renderer code in client JS.",
);
