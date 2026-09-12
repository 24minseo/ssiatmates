import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../../components/app/AppShell";

export const Route = createFileRoute("/calendar/")({
  component: CalendarPage,
});

function CalendarPage() {
  return (
    <AppShell active="calendar">
      <h1 className="text-[28px] font-bold leading-tight text-ink">
        전체 캘린더
      </h1>
    </AppShell>
  );
}
