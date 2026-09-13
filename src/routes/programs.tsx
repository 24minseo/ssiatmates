import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/programs")({
  component: ProgramsPage,
});

function ProgramsPage() {
  return (
    <>
      <h1 className="text-[28px] font-bold leading-tight text-ink">
        지원사업 탐색
      </h1>
    </>
  );
}
