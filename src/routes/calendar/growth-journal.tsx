import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/calendar/growth-journal")({
  component: GrowthJournalPage,
});

function GrowthJournalPage() {
  return (
    <>
      <h1 className="text-[28px] font-bold leading-tight text-ink">성장일지</h1>
    </>
  );
}
