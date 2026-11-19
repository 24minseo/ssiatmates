import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSlides,
  extractSections,
  mediaUrl,
  newDraft,
  restoreWorkspace,
  videoEmbed,
} from "./model.ts";

test("recognized business fields populate their own slides without inventing missing content", () => {
  const source =
    "사업명: SSIAT\n문제 인식: 탐색의 어려움\n핵심 고객: 창업자\n해결책: 맞춤 탐색\n왜 지금: 디지털 전환";
  const review = extractSections(source);
  review["해결책"] = "사용자가 수정한 해결책";
  const slides = buildSlides(review, source);
  assert.equal(slides.length, 7);
  assert.deepEqual(
    slides.map((slide) => slide.name),
    ["Business", "Problem", "Target Customer", "Solution", "Product & Service", "Market Analysis", "Revenue Model"],
  );
  assert.equal(slides[0]?.title, "SSIAT");
  assert.equal(slides[1]?.body, "탐색의 어려움");
  assert.equal(slides[2]?.body, "창업자");
  assert.equal(slides[3]?.body, "사용자가 수정한 해결책");
  assert.match(slides[5]!.body, /문서에서 확인된 내용이 없습니다/);
});
test("a customer without a problem does not retain the missing-content placeholder", () => {
  assert.equal(buildSlides({ "핵심 고객": "창업자" }, "")[2]?.body, "창업자");
});
test("legacy string slides and their shared source are preserved during migration", () => {
  const legacy = JSON.stringify({
    source: "기존 본문",
    theme: "Bold Momentum",
    slides: ["기존 제목", "기존 두 번째 제목"],
  });
  const restored = restoreWorkspace(null, legacy)!;
  assert.equal(restored.projects.length, 1);
  assert.equal(restored.draft.slides[1]?.title, "기존 두 번째 제목");
  assert.equal(restored.draft.slides[1]?.body, "기존 본문");
  assert.equal(restored.draft.theme, "Bold Momentum");
  assert.equal(restored.draft.projectId, restored.projects[0]?.id);
});
test("older source/theme-only saves can also be restored", () => {
  const restored = restoreWorkspace(
    null,
    JSON.stringify({ source: "사업명: 이전 사업", selectedTheme: "Human Impact" }),
  )!;
  assert.equal(restored.draft.theme, "Human Impact");
  assert.equal(restored.draft.slides[0]?.title, "이전 사업");
});
test("new workspace restores independent slide content, formatting and media", () => {
  const draft = newDraft();
  draft.slides[1]!.body = "두 번째 슬라이드만 변경";
  draft.slides[1]!.elements.push({ id: "text", type: "text", text: "추가 내용" });
  const workspace = { draft, projects: [] };
  assert.deepEqual(restoreWorkspace(JSON.stringify(workspace), null), workspace);
  assert.notEqual(draft.slides[0]!.body, draft.slides[1]!.body);
});
test("malformed current storage is ignored without blocking the workspace", () => {
  assert.equal(restoreWorkspace("{broken", JSON.stringify({ source: "legacy" }))?.draft.source, "legacy");
  assert.equal(restoreWorkspace(JSON.stringify({ draft: { slides: [] }, projects: [] }), null), null);
});
test("media URLs accept web protocols and only embed known YouTube hosts", () => {
  assert.equal(mediaUrl("javascript:alert(1)"), null);
  assert.equal(mediaUrl("data:text/html,example"), null);
  assert.equal(mediaUrl("https://example.com/image.png"), "https://example.com/image.png");
  assert.equal(
    videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbed("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(videoEmbed("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"), null);
});
