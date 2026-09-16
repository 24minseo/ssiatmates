import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgramCard } from "@/components/my-programs/ProgramCard";
import { ProgramFormDialog } from "@/components/my-programs/ProgramFormDialog";
import { ProgramScheduleDialog } from "@/components/my-programs/ProgramScheduleDialog";
import {
  StatusTabs,
  type StatusTabValue,
} from "@/components/my-programs/StatusTabs";
import {
  programService,
  type Program,
  type ProgramInput,
  type ProgramStatus,
  type ScheduleInput,
} from "@/services/mockProgramService";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-programs")({
  component: MyProgramsPage,
});

type StatusFilter = StatusTabValue;
type SortOption = "deadline" | "fit" | "created";

const sortLabels: Record<SortOption, string> = {
  deadline: "마감 임박순",
  fit: "적합도순",
  created: "최신 등록순",
};

function MyProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("deadline");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [scheduleProgram, setScheduleProgram] = useState<Program | null>(null);

  useEffect(() => {
    let mounted = true;
    programService
      .list()
      .then((items) => {
        if (!mounted) return;
        setPrograms(items);
        setLoadError(null);
      })
      .catch(() => {
        if (mounted) setLoadError("지원사업을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: programs.length,
      preparing: programs.filter((program) => program.status === "preparing")
        .length,
      submitted: programs.filter((program) => program.status === "submitted")
        .length,
    }),
    [programs],
  );

  const visiblePrograms = useMemo(() => {
    const filtered =
      activeFilter === "all"
        ? [...programs]
        : programs.filter((program) => program.status === activeFilter);

    return filtered.sort((a, b) => {
      if (sort === "fit") return b.fitScore - a.fitScore;
      if (sort === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return (
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      );
    });
  }, [activeFilter, programs, sort]);

  function openCreateDialog() {
    setEditingProgram(null);
    setFormOpen(true);
  }

  function openEditDialog(program: Program) {
    setEditingProgram(program);
    setFormOpen(true);
  }

  function replaceProgram(updated: Program) {
    setPrograms((current) =>
      current.map((program) => (program.id === updated.id ? updated : program)),
    );
  }

  async function handleProgramSubmit(input: ProgramInput) {
    setSaving(true);
    try {
      const saved = editingProgram
        ? await programService.update(editingProgram.id, input)
        : await programService.create(input);
      if (editingProgram) {
        replaceProgram(saved);
        toast.success("지원사업을 수정했습니다.");
      } else {
        setPrograms((current) => [saved, ...current]);
        toast.success("지원사업을 추가했습니다.");
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await programService.remove(deleteTarget.id);
      setPrograms((current) =>
        current.filter((program) => program.id !== deleteTarget.id),
      );
      toast.success("지원사업을 삭제했습니다.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(program: Program, status: ProgramStatus) {
    try {
      const updated = await programService.updateStatus(program.id, status);
      replaceProgram(updated);
      toast.success("상태를 변경했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "상태를 변경하지 못했습니다.");
    }
  }

  async function handleScheduleAdd(input: ScheduleInput) {
    if (!scheduleProgram) return;
    setSaving(true);
    try {
      const updated = await programService.addSchedule(scheduleProgram.id, input);
      replaceProgram(updated);
      setScheduleProgram(updated);
      toast.success("일정을 추가했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "일정을 추가하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleScheduleToggle(scheduleId: string) {
    if (!scheduleProgram) return;
    setSaving(true);
    try {
      const updated = await programService.toggleSchedule(
        scheduleProgram.id,
        scheduleId,
      );
      replaceProgram(updated);
      setScheduleProgram(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "일정을 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleScheduleRemove(scheduleId: string) {
    if (!scheduleProgram) return;
    setSaving(true);
    try {
      const updated = await programService.removeSchedule(
        scheduleProgram.id,
        scheduleId,
      );
      replaceProgram(updated);
      setScheduleProgram(updated);
      toast.success("일정을 삭제했습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "일정을 삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-[18px]">
      <div className="flex items-center">
        <h1 className="text-[28px] font-extrabold leading-tight text-ink">
          내 지원사업
        </h1>
      </div>

      <div className="relative h-[48px] w-full">
        <StatusTabs
          selected={activeFilter}
          counts={{
            all: counts.all,
            preparing: counts.preparing,
            submitted: counts.submitted,
          }}
          onChange={setActiveFilter}
        />

        <div className="absolute right-0 top-[-1px] flex items-center gap-[6px]">
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as SortOption)}
          >
            <SelectTrigger
              aria-label="지원사업 정렬"
              className="h-[42px] w-[136px] rounded-[12px] border-field-border bg-surface px-[14px] text-[15px] font-semibold text-ink shadow-none [&>svg]:transition-transform data-[state=open]:[&>svg]:rotate-180"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-[12px] border-0 shadow-dropdown">
              <SelectItem value="deadline">{sortLabels.deadline}</SelectItem>
              <SelectItem value="fit">{sortLabels.fit}</SelectItem>
              <SelectItem value="created">{sortLabels.created}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            aria-label="지원사업 추가"
            onClick={openCreateDialog}
            className="size-[42px] shrink-0 rounded-[12px] border border-field-border bg-surface p-0 text-ink shadow-none hover:bg-item-hover"
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-[12px] border border-destructive/30 bg-destructive/5 px-5 py-4 text-[14px] text-destructive" role="alert">
          {loadError}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center text-ink-muted" role="status">
          <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
          불러오는 중…
        </div>
      ) : visiblePrograms.length > 0 ? (
        <div className="space-y-[18px]">
          {visiblePrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onEdit={openEditDialog}
              onDelete={setDeleteTarget}
              onStatusChange={handleStatusChange}
              onManageSchedules={setScheduleProgram}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[12px] bg-item-hover px-6 py-16 text-center">
          <p className="text-[16px] font-semibold text-ink">
            표시할 지원사업이 없습니다.
          </p>
          <p className="mt-2 text-[14px] text-ink-muted">
            새 지원사업을 추가하거나 다른 상태를 선택해보세요.
          </p>
          <Button
            type="button"
            onClick={openCreateDialog}
            className="mt-5 h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88"
          >
            지원사업 추가
          </Button>
        </div>
      )}

      <ProgramFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        program={editingProgram}
        saving={saving}
        onSubmit={handleProgramSubmit}
      />

      <ProgramScheduleDialog
        open={Boolean(scheduleProgram)}
        onOpenChange={(open) => {
          if (!open) setScheduleProgram(null);
        }}
        program={scheduleProgram}
        saving={saving}
        onAdd={handleScheduleAdd}
        onToggle={handleScheduleToggle}
        onRemove={handleScheduleRemove}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-[20px] border-0 bg-surface">
          <AlertDialogHeader>
            <AlertDialogTitle>지원사업을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title}와 연결된 일정도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "삭제 중…" : "삭제하기"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
