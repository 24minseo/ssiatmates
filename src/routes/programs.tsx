import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app/AppShell";

export const Route = createFileRoute("/programs")({
  component: ProgramsPage,
});

function ProgramsPage() {
  return (
    <AppShell active="programs">
      <h1 className="text-[28px] font-bold leading-tight text-ink">지원사업 탐색</h1>
    </AppShell>
  );
}
