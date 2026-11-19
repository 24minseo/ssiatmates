import assert from "node:assert/strict";
import test from "node:test";
import {
  createAnalysisApi,
  hashText,
  validatePlanFile,
  reviewSections,
  sectionIds,
} from "./analysis";
import { newDraft } from "./model";
const owner = "11111111-1111-4111-8111-111111111111",
  source = "22222222-2222-4222-8222-222222222222",
  deck = "33333333-3333-4333-8333-333333333333",
  job = "44444444-4444-4444-8444-444444444444",
  request = "55555555-5555-4555-8555-555555555555";
const textRef = {
  userId: owner,
  sourceId: source,
  requestId: request,
  inputKind: "text" as const,
  inputHash: "a".repeat(64),
};
test("text submission preserves whole source, request identities and resume avoids a second AI dispatch", async () => {
  const calls: Record<string, unknown>[] = [];
  const api = createAnalysisApi({
    upload: async () => {
      throw Error("no upload");
    },
    call: async (_name, body) => {
      calls.push(body);
      return body["action"] === "prepare_input"
        ? { source_id: source, deck_id: deck, source_state: "ready" }
        : { job_id: job, deck_id: deck, source_id: source, status: "queued" };
    },
  });
  const text = "맥락이 모두 전달되는 사업 설명입니다. ".repeat(20);
  const result = await api.submit(
    textRef,
    text,
    null,
    () => {},
    () => {},
  );
  assert.equal(calls[0]?.["text"], text.trim());
  assert.equal(calls[1]?.["client_request_id"], request);
  assert.equal(result.jobId, job);
  await api.submit(
    result,
    text,
    null,
    () => {},
    () => {},
  );
  assert.equal(calls.length, 2);
});
test("PDF content validation and lost upload acknowledgement use confirmed private object", async () => {
  const file = new File(["%PDF-1.7\nfixture"], "plan.pdf", { type: "application/pdf" });
  const hash = await validatePlanFile(file);
  assert.equal(hash.length, 64);
  await assert.rejects(validatePlanFile(new File(["not pdf"], "fake.pdf")));
  await assert.rejects(validatePlanFile(new File(["%PDF-"], "wrong.docx")));
  const calls: string[] = [];
  const path = owner + "/" + deck + "/" + source + "/source.pdf";
  const api = createAnalysisApi({
    upload: async (actual, token) => {
      assert.equal(actual, path);
      assert.equal(token, "signed");
      calls.push("upload");
      throw Error("lost acknowledgement");
    },
    call: async (_name, body) => {
      calls.push(String(body["action"]));
      if (body["action"] === "prepare_input")
        return {
          source_id: source,
          deck_id: deck,
          source_state: "reserved",
          bucket_id: "ir-deck-assets",
          object_path: path,
          upload: { object_path: path, bucket_id: "ir-deck-assets", token: "signed" },
        };
      if (body["action"] === "confirm_pdf") return { success: true };
      return { job_id: job, deck_id: deck, source_id: source, status: "queued" };
    },
  });
  await api.submit(
    { ...textRef, inputKind: "pdf", fileName: "plan.pdf", fileSize: file.size, inputHash: hash },
    "",
    file,
    () => {},
    () => {},
  );
  assert.deepEqual(calls, ["prepare_input", "upload", "confirm_pdf", "request_generation"]);
});
test("review includes full server body and title edits round-trip without dropping notes", async () => {
  let saved = false;
  const api = createAnalysisApi({
    upload: async () => {},
    call: async (_name, body) => {
      if (body["action"] === "get_preview")
        return {
          ready: true,
          job_id: job,
          deck_id: deck,
          slides: sectionIds.map((section_id, i) => ({
            section_id,
            content: { title: "제목 " + i },
          })),
        };
      if (body["action"] === "save_business") {
        const sections = body["sections"] as { body: string }[];
        assert.equal(sections[0]?.body, "# 사용자가 고친 제목\n\n긴 본문\n추가 분석 맥락");
        saved = true;
        return { saved: true, revision: 1, is_current: true };
      }
      return {
        ready: true,
        deck_id: deck,
        revision: saved ? 1 : 0,
        sections: sectionIds.map((section_id, i) => ({
          section_id,
          body:
            i === 0
              ? saved
                ? "# 사용자가 고친 제목\n\n긴 본문\n추가 분석 맥락"
                : "긴 본문\n추가 분석 맥락"
              : "본문 " + i,
        })),
      };
    },
  });
  const ref = { ...textRef, jobId: job, deckId: deck };
  const result = await api.review(ref);
  assert.equal(result.slides.length, 7);
  assert.equal(result.slides[0]?.body, "긴 본문\n추가 분석 맥락");
  result.slides[0]!.title = "사용자가 고친 제목";
  await api.save(ref, reviewSections(result.slides), request, 0);
  const restored = await api.review(ref);
  assert.equal(restored.slides[0]?.title, "사용자가 고친 제목");
  assert.equal(restored.slides[0]?.body, "긴 본문\n추가 분석 맥락");
});
test("mixed job identity and stale save acknowledgements are rejected", async () => {
  const api = createAnalysisApi({
    upload: async () => {},
    call: async (_name, body) =>
      body["action"] === "get_job"
        ? { job_id: job, deck_id: deck, source_id: request, status: "completed" }
        : { saved: true, revision: 1, is_current: false },
  });
  await assert.rejects(api.status({ ...textRef, jobId: job, deckId: deck }));
  await assert.rejects(
    api.save({ ...textRef, deckId: deck }, reviewSections(newDraft().slides), request, 0),
  );
  assert.equal(await hashText("same"), await hashText("same"));
});
