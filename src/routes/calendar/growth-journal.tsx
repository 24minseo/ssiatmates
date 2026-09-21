import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/calendar/growth-journal")({
  head: () => ({ meta: [{ title: "성장일지" }] }),
  component: GrowthJournalPage,
});

function GrowthJournalPage() {
  return (
    <>
      <h1 className="text-[28px] font-bold leading-tight text-ink">성장일지</h1>
    </>
  );
}
