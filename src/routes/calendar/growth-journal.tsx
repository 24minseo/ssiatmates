import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../../components/app/AppShell";

export const Route = createFileRoute("/calendar/growth-journal")({
  component: GrowthJournalPage,
});

function GrowthJournalPage() {
  return (
    <AppShell active="growth-journal">
      <h1 className="text-[28px] font-bold leading-tight text-ink">성장일지</h1>
    </AppShell>
  );
}
