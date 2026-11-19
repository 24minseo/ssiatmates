import assert from "node:assert/strict";
import test from "node:test";
import {
  parseView,
  signedUrl,
  startHtml,
  validatePlacement,
  type ApiCall,
  type HtmlReference,
} from "./html-api";

const reference: HtmlReference = {
  userId: "owner",
  deckId: "deck",
  sourceId: "source",
  requestId: "receipt",
  brandSaveId: "brand-save",
  businessRevision: 3,
  settings: { brandColors: ["#123456"], theme: "dark", fontFamily: "Pretendard" },
};
test("a lost generation acknowledgement retries the same immutable input snapshot", async () => {
  const requests: Record<string, unknown>[] = [];
  let current = reference,
    brandSaves = 0;
  const call: ApiCall = async (_name, body) => {
    switch (body["action"]) {
      case "get_brand_settings":
        return { revision: 0, settings: null };
      case "save_brand_settings":
        brandSaves++;
        return { saved: true, revision: 4 };
      default:
        requests.push(body);
        if (requests.length === 1) throw Error("lost response");
        return { job_id: "job", state: "queued" };
    }
  };
  await assert.rejects(
    startHtml(call, current, (r) => {
      current = r;
    }),
    /lost response/,
  );
  assert.equal(current.brandRevision, 4);
  await startHtml(call, current, (r) => {
    current = r;
  });
  assert.equal(brandSaves, 1);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[0]?.["expected_business_revision"], 3);
});
test("a previously saved brand is reused without an extra revision", async () => {
  const calls: string[] = [];
  await startHtml(
    async (_name, body) => {
      calls.push(String(body["action"]));
      return body["action"] === "get_brand_settings"
        ? { revision: 7, settings: reference.settings }
        : { job_id: "job", state: "queued" };
    },
    reference,
    (r) => assert.equal(r.brandRevision, 7),
  );
  assert.deepEqual(calls, ["get_brand_settings", "request_generation"]);
});
test("only validated seven-slide documents owned by the requested deck can render", () => {
  const view = {
    document_id: "doc",
    deck_id: "deck",
    image_revision: 2,
    validation: { security_checked: true, original_html_render_checked: true },
    imageSlots: [],
    document: {
      schemaVersion: "ir_html_v1",
      canvas: { width: 1920, height: 1080 },
      designTokens: { colors: { CANVAS: "#F7F8FA" } },
      slides: Array.from({ length: 7 }, (_, i) => ({
        slideId: `slide-${i + 1}`,
        sectionLabel: "항목",
        headline: "문장형 핵심 메시지",
        html: "<section></section>",
        css: "",
      })),
    },
  };
  assert.equal(parseView(view, "deck").image_revision, 2);
  assert.throws(() => parseView(view, "other"));
  assert.throws(() => parseView({ ...view, validation: { security_checked: false } }, "deck"));
  assert.throws(() =>
    parseView(
      { ...view, document: { ...view.document, slides: view.document.slides.slice(0, 6) } },
      "deck",
    ),
  );
});
test("signed files cannot navigate to another host or an unrelated bucket", () => {
  const base = "https://test.supabase.co",
    bucket = "ir-deck-html-exports-v1";
  assert.match(
    signedUrl(`${base}/storage/v1/object/sign/${bucket}/a/result.pdf?token=t`, base, bucket),
    /result.pdf/,
  );
  for (const raw of [
    `https://attacker.invalid/storage/v1/object/sign/${bucket}/x?token=t`,
    `${base}/storage/v1/object/sign/other/x?token=t`,
    `${base}/storage/v1/object/sign/${bucket}/x`,
    `http://test.supabase.co/storage/v1/object/sign/${bucket}/x?token=t`,
  ])
    assert.throws(() => signedUrl(raw, base, bucket));
});
test("user images must stay inside the slide with a bounded layer order", () => {
  validatePlacement({ x: 100, y: 200, width: 640, height: 360, zIndex: 100 });
  for (const p of [
    { x: -1, y: 0, width: 1, height: 1, zIndex: 1 },
    { x: 1800, y: 0, width: 640, height: 360, zIndex: 1 },
    { x: 0, y: 0, width: 640, height: 0, zIndex: 1 },
    { x: 0, y: 0, width: 640, height: 360, zIndex: 10001 },
  ])
    assert.throws(() => validatePlacement(p));
});
