import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-programs")({
  component: MyProgramsPage,
});

function MyProgramsPage() {
  return (
    <>
      <h1 className="text-[28px] font-bold leading-tight text-ink">
        내 지원사업
      </h1>
    </>
  );
}
