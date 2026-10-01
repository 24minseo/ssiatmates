import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ProgramCard } from "@/components/my-programs/ProgramCard";
import {
  ProgramSortDropdown,
  type ProgramSortOption,
} from "@/components/my-programs/ProgramSortDropdown";
import { ProgramFormDialog } from "@/components/my-programs/ProgramFormDialog";
import { ProgramScheduleDialog } from "@/components/my-programs/ProgramScheduleDialog";
import { ProgramReportDialog } from "@/components/programs/ProgramReportDialog";
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
} from "@/services/programRepository";
import {
  savedNoticesApi,
  type SavedNotice,
} from "@/services/savedNoticesApi";
import { useAuth } from "@/hooks/useAuth";
import { formatProgramRegion } from "@/lib/programRegion";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-programs")({
  head: () => ({ meta: [{ title: "내 지원사업" }] }),
  component: MyProgramsPage,
});

type StatusFilter = StatusTabValue;
type SortOption = ProgramSortOption;

const NO_DEADLINE = "9999-12-31T23:59:59.000Z";
const SAVED_STATUS_STORAGE_PREFIX = "ssiat.my-programs.saved-status.v1";

function isProgramStatus(value: unknown): value is ProgramStatus {
  return value === "not_started" || value === "preparing" || value === "submitted";
}

function savedStatusStorageKey(userId: string) {
  return `${SAVED_STATUS_STORAGE_PREFIX}:${userId}`;
}

function readSavedStatuses(userId: string): Record<string, ProgramStatus> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(savedStatusStorageKey(userId)) ?? "{}",
    );
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    const statuses: Record<string, ProgramStatus> = {};
    for (const [noticeId, status] of Object.entries(parsed)) {
      if (isProgramStatus(status)) statuses[noticeId] = status;
    }
    return statuses;
  } catch {
    return {};
  }
}

function writeSavedStatus(userId: string, noticeId: string, status: ProgramStatus) {
  const statuses = readSavedStatuses(userId);
  localStorage.setItem(
    savedStatusStorageKey(userId),
    JSON.stringify({ ...statuses, [noticeId]: status }),
  );
}

function removeSavedStatus(userId: string, noticeId: string) {
  try {
    const statuses = readSavedStatuses(userId);
    delete statuses[noticeId];
    localStorage.setItem(savedStatusStorageKey(userId), JSON.stringify(statuses));
  } catch {
    // Status cleanup is best effort; unsaving the notice should still succeed.
  }
}

function toSavedProgram(item: SavedNotice, index: number): Program {
  return {
    id: item.notice_id,
    source: "saved",
    ...(item.url ? { url: item.url } : {}),
    title: item.title,
    organization: item.organization,
    category: item.field ?? "지원 분야 확인 필요",
    stage: "",
    region: formatProgramRegion(item.region) ?? "",
    status: "not_started",
    deadline: item.deadline ?? NO_DEADLINE,
    deadlineLabel: item.deadline_label ?? (item.is_closed ? "마감" : "일정 확인 필요"),
    isClosed: item.is_closed,
    createdAt: new Date(Date.now() - index).toISOString(),
    fitScore: 0,
    schedules: [],
  };
}

function SquareAlertIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor" />
      <path
        d="M12 7.5V12.75"
        stroke="var(--surface)"
        strokeWidth="2.5"
        strokeLinecap="round"
        transform="rotate(180 12 12)"
      />
      <circle cx="12" cy="16.75" r="1.4" fill="var(--surface)" transform="rotate(180 12 12)" />
    </svg>
  );
}

function MyProgramsPage() {
  const navigate = Route.useNavigate();
  const { loading: authLoading, session } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("created");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [scheduleProgram, setScheduleProgram] = useState<Program | null>(null);
  const [reportTarget, setReportTarget] = useState<Program | null>(null);
  const savedRequestRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const requestId = savedRequestRef.current + 1;
    savedRequestRef.current = requestId;

    if (authLoading) return () => {
      mounted = false;
    };

    if (!session?.user.id) {
      setPrograms([]);
      setLoading(false);
      setLoadError(null);
      return () => {
        mounted = false;
      };
    }

    const userId = session.user.id;
    setLoading(true);
    setLoadError(null);
    savedNoticesApi
      .getMySupportNotices()
      .then(({ items }) => {
        if (!mounted || savedRequestRef.current !== requestId) return;
        const savedStatuses = readSavedStatuses(userId);
        setPrograms(
          items.map((item, index) => {
            const program = toSavedProgram(item, index);
            return {
              ...program,
              status: savedStatuses[item.notice_id] ?? program.status,
            };
          }),
        );
      })
      .catch((error) => {
        if (!mounted || savedRequestRef.current !== requestId) return;
        console.error("[my-programs] 저장 공고 조회 실패", error);
        setPrograms([]);
        setLoadError("저장한 지원사업을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted && savedRequestRef.current === requestId) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authLoading, session?.user.id]);

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
      const now = Date.now();
      const aExpired = new Date(a.deadline).getTime() < now;
      const bExpired = new Date(b.deadline).getTime() < now;

      if (aExpired !== bExpired) {
        return aExpired ? 1 : -1;
      }

      if (sort === "fit") {
        const statusOrder: Record<ProgramStatus, number> = {
          not_started: 0,
          preparing: 1,
          submitted: 2,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      if (sort === "created") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
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
      if (deleteTarget.source === "saved") {
        await savedNoticesApi.setSaved(deleteTarget.id, false);
        if (session?.user.id) removeSavedStatus(session.user.id, deleteTarget.id);
      } else {
        await programService.remove(deleteTarget.id);
      }
      setPrograms((current) =>
        current.filter((program) => program.id !== deleteTarget.id),
      );
      toast.success(
        deleteTarget.source === "saved"
          ? "관심 공고 저장을 해제했습니다."
          : "지원사업을 삭제했습니다.",
      );
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(program: Program, status: ProgramStatus) {
    try {
      if (program.source === "saved") {
        if (!session?.user.id) throw new Error("로그인이 필요합니다.");
        writeSavedStatus(session.user.id, program.id, status);
        replaceProgram({ ...program, status });
        toast.success("상태를 변경했습니다.");
        return;
      }

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
        <h1 className="text-[28px] font-bold leading-tight text-ink">
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
          <ProgramSortDropdown value={sort} onChange={setSort} variant="myPrograms" />
          <Button
            type="button"
            aria-label="지원사업 추가"
            onClick={openCreateDialog}
            className="size-[42px] shrink-0 rounded-[12px] border border-field-border bg-surface p-0 text-ink shadow-none hover:bg-item-hover"
          >
            <img src="/assets/my-programs/plus-20.svg" alt="" aria-hidden className="size-5" draggable={false} />
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
      ) : loadError ? null : visiblePrograms.length > 0 ? (
        <div className="space-y-[18px]">
          {visiblePrograms.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              onEdit={openEditDialog}
              onDelete={setDeleteTarget}
              onReportClick={setReportTarget}
              onStatusChange={handleStatusChange}
              onManageSchedules={setScheduleProgram}
            />
          ))}
        </div>
      ) : counts.all === 0 ? (
        <div className="rounded-[12px] bg-item-hover px-6 py-16 text-center">
          <p className="text-[16px] font-semibold text-ink">저장된 지원사업이 없습니다</p>
          <p className="mt-2 text-[14px] text-ink-muted">
            지원사업을 탐색하거나 직접 추가해 진행 상황을 관리해 보세요.
          </p>
          <Button
            type="button"
            onClick={() => void navigate({ to: "/programs" })}
            className="mt-5 h-10 rounded-[10px] bg-brand px-4 text-[14px] font-semibold text-brand-foreground shadow-none hover:bg-brand/88"
          >
            지원사업 탐색
          </Button>
        </div>
      ) : (
        <div className="rounded-[12px] bg-item-hover px-6 py-16 text-center">
          <p className="text-[16px] font-semibold text-ink">표시할 지원사업이 없습니다.</p>
          <p className="mt-2 text-[14px] text-ink-muted">다른 상태를 선택해보세요.</p>
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

      <ProgramReportDialog
        open={Boolean(reportTarget)}
        onOpenChange={(open) => {
          if (!open) setReportTarget(null);
        }}
        noticeId={reportTarget?.source === "saved" ? reportTarget.id : null}
        noticeTitle={reportTarget?.title ?? null}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent
          className="w-[calc(100vw-32px)] max-w-[560px] overflow-hidden rounded-[20px] border-0 bg-surface"
          onOverlayClick={() => {
            if (saving) {
              return;
            }
            setDeleteTarget(null);
          }}
        >
          <AlertDialogHeader className="min-w-0 w-full max-w-full">
            <AlertDialogTitle className="mb-4 text-[20px] font-bold leading-7 text-ink">
              내 지원사업에서 삭제할까요?
            </AlertDialogTitle>
            <div className="min-h-10">
              <AlertDialogDescription className="flex h-11 min-w-0 w-full max-w-full items-center gap-1 overflow-hidden rounded-[12px] bg-item-hover px-3 py-2 text-left text-[14px] font-medium leading-5 text-ink-muted">
                <SquareAlertIcon className="size-4 shrink-0 text-icon-muted" />
                <span className="min-w-0 truncate">
                  {deleteTarget && deleteTarget.schedules.length > 0
                    ? `연결된 일정 ${deleteTarget.schedules.length}개도 함께 삭제됩니다.`
                    : "연결된 일정 없이 공고만 삭제됩니다."}
                </span>
              </AlertDialogDescription>
            </div>
            <div className="mt-2 min-h-12 min-w-0 w-full max-w-full text-left">
              <p className="px-1 text-[14px] font-medium leading-5 text-submenu-text">
                삭제할 공고
              </p>
              <p
                className="mt-2 flex h-11 w-full min-w-0 max-w-full items-center overflow-hidden rounded-[12px] border border-field-border px-3 text-[16px] font-semibold leading-6 text-ink"
                title={deleteTarget?.title}
              >
                <span className="block min-w-0 truncate">
                  {deleteTarget?.title}
                </span>
              </p>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel
              disabled={saving}
              className="h-11 rounded-[12px] border-0 bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover focus-visible:ring-1 focus-visible:ring-focus-soft"
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="h-11 rounded-[12px] border-0 bg-[#E95152] px-5 text-[15px] font-semibold text-white shadow-none hover:bg-[#E95152]/90 focus-visible:ring-1 focus-visible:ring-focus-soft"
            >
              {saving ? "삭제 중…" : "내 지원사업에서 삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
