import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "../components/app/AppShell";

export const Route = createFileRoute("/my-programs")({
  component: MyProgramsPage,
});

function MyProgramsPage() {
  return (
    <AppShell active="my-programs">
      <h1 className="text-[28px] font-bold leading-tight text-ink">
        내 지원사업
      </h1>
    </AppShell>
  );
}
