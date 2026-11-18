import assert from "node:assert/strict";
import { test } from "node:test";
import { createManualNoticeAnalysisApi } from "../src/services/manualNoticeAnalysisApi.ts";
const id = "11111111-1111-4111-8111-111111111111";
const url = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?pbancSn=175783";
const hit = {
  success: true,
  cache_hit: true,
  status: "ready",
  manual_notice_id: id,
  notice: { title: "공고" },
  report: { matching_conditions: {}, sections: {} },
  is_confirmed: false,
};
test("cache integration and existing analysis fallback", async () => {
  const original = globalThis.fetch;
  let webhooks = 0,
    owner = "a",
    value = hit,
    error = null,
    wait = null,
    lookupCount = 0;
  let sentBody;
  globalThis.fetch = async (_url, init) => {
    sentBody = JSON.parse(init.body);
    webhooks++;
    return Response.json(hit);
  };
  const client = {
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: owner }, access_token: "token" } },
      }),
    },
    rpc: (name, body) => {
      lookupCount++;
      assert.equal(name, "get_my_manual_notice_url_cache_v1");
      assert.equal(body.p_url, url);
      return {
        abortSignal: async (signal) => {
          assert.ok(signal instanceof AbortSignal);
          if (wait) await wait;
          return { data: value, error };
        },
      };
    },
  };
  try {
    const api = createManualNoticeAnalysisApi(client);
    assert.equal((await api.analyze({ url })).manual_notice_id, id);
    assert.equal(webhooks, 0);
    value = { ...hit, status: "confirmed", is_confirmed: true };
    assert.equal((await api.analyze({ url })).status, "confirmed");
    assert.equal(webhooks, 0);
    value = { cache_hit: false };
    await api.analyze({ url });
    assert.equal(webhooks, 1);
    assert.equal(sentBody.cache_diagnostic.outcome, "cache_miss");
    value = hit;
    error = { code: "PGRST202", message: "PRIVATE ERROR TEXT" };
    await api.analyze({ url });
    assert.equal(webhooks, 2);
    assert.equal(sentBody.cache_diagnostic.outcome, "rpc_error");
    assert.equal(sentBody.cache_diagnostic.error_code, "PGRST202");
    assert.ok(!JSON.stringify(sentBody).includes("PRIVATE ERROR TEXT"));
    error = null;
    value = { ...hit, report: [] };
    await api.analyze({ url });
    assert.equal(webhooks, 3);
    assert.equal(sentBody.cache_diagnostic.outcome, "invalid_response");
    value = hit;
    const before = lookupCount;
    await api.analyze({ url, forceRefresh: true });
    assert.equal(lookupCount, before);
    assert.equal(sentBody.cache_diagnostic.outcome, "force_refresh");
    assert.equal(webhooks, 4);
    let release;
    wait = new Promise((r) => (release = r));
    const first = api.analyze({ url }),
      second = api.analyze({ url });
    await new Promise((r) => setTimeout(r, 0));
    owner = "b";
    release();
    assert.equal((await first).status, "stale");
    assert.equal((await second).status, "stale");
    assert.equal(webhooks, 4);
    wait = null;
    owner = "a";
    value = hit;
    await api.analyze({ url });
    assert.equal(webhooks, 4);
    wait = new Promise((r) => (release = r));
    const clearing = api.analyze({ url });
    await new Promise((r) => setTimeout(r, 0));
    api.clear();
    release();
    assert.equal((await clearing).status, "stale");
  } finally {
    globalThis.fetch = original;
  }
});
