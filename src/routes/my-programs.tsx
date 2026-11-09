import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { SquareAlertIcon } from "@/components/ui/square-alert-icon";
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
import { getCalendarEvents } from "@/services/calendarEventsApi";
import { normalizeCalendarEvents } from "@/services/calendarEventModel";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/my-programs")({
  head: () => ({ meta: [{ title: "내 지원사업" }] }),
  component: MyProgramsPage,
});

type StatusFilter = StatusTabValue;
type SortOption = ProgramSortOption;

const NO_DEADLINE = "9999-12-31T23:59:59.000Z";

function safeNoticeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function toSavedProgram(item: SavedNotice, index: number): Program {
  const url = safeNoticeUrl(item.url);

  return {
    id: item.notice_id,
    source: "saved",
    ...(url ? { url } : {}),
    title: item.title,
    organization: item.organization,
    category: item.field ?? "지원 분야 확인 필요",
    stage: "",
    region: formatProgramRegion(item.region) ?? "",
    status: "not_started",
    deadline: item.deadline ?? NO_DEADLINE,
    deadlineLabel: item.deadline_label ?? (item.is_closed ? "마감" : "일정 확인 필요"),
    isClosed: item.is_closed,
    createdAt: item.saved_at ?? new Date(Date.now() - index).toISOString(),
    fitScore: 0,
    schedules: [],
  };
}

function MyProgramsPage() {
  const navigate = Route.useNavigate();
  const { loading: authLoading, session } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [savedTotalCount, setSavedTotalCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("created");
  const [retryCount, setRetryCount] = useState(0);
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
    if (activeFilter !== "all" && sort === "fit") setSort("created");
  }, [activeFilter, sort]);

  useEffect(() => {
    let mounted = true;
    const requestId = savedRequestRef.current + 1;
    savedRequestRef.current = requestId;

    if (authLoading) return () => {
      mounted = false;
    };

    if (!session?.user.id) {
      setPrograms([]);
      setSavedTotalCount(0);
      setLoading(false);
      setLoadError(null);
      return () => {
        mounted = false;
      };
    }

    const userId = session.user.id;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      savedNoticesApi.getMySupportNotices(),
      savedNoticesApi.getMyProgress(),
      getCalendarEvents({ data: { accessToken: session.access_token } }).catch(() => ({ events: [] })),
    ])
      .then(([{ items, total_count }, { items: progressItems }, calendarResult]) => {
        if (!mounted || savedRequestRef.current !== requestId) return;
        const calendarEvents = normalizeCalendarEvents(calendarResult.events);
        setSavedTotalCount(total_count ?? items.length);
        const savedStatuses = Object.fromEntries(
          progressItems.map((item) => [item.notice_id, item.status]),
        );
        setPrograms(
          items.map((item, index) => {
            const program = toSavedProgram(item, index);
            return {
              ...program,
              schedules: calendarEvents
                .filter((event) => event.savedNoticeId === item.saved_notice_id)
                .map((event) => ({
                  id: String(event.id),
                  programId: item.notice_id,
                  title: event.eventType === "application_deadline" ? "[접수 마감일]" : event.title,
                  scheduledAt: `${event.date}T00:00:00`,
                  completed: event.completed === true,
                })),
              status: savedStatuses[item.notice_id] ?? program.status,
            };
          }),
        );
      })
      .catch((error) => {
        if (!mounted || savedRequestRef.current !== requestId) return;
        console.error("[my-programs] 저장 공고 조회 실패", error);
        setPrograms([]);
        setSavedTotalCount(0);
        setLoadError("저장한 지원사업을 불러오는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.");
      })
      .finally(() => {
        if (mounted && savedRequestRef.current === requestId) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [authLoading, retryCount, session?.user.id]);

  const counts = useMemo(
    () => ({
      all: savedTotalCount + programs.filter((program) => program.source === "manual").length,
      preparing: programs.filter((program) => program.status === "preparing")
        .length,
      submitted: programs.filter((program) => program.status === "submitted")
        .length,
    }),
    [programs, savedTotalCount],
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
      } else {
        await programService.remove(deleteTarget.id);
      }
      setPrograms((current) =>
        current.filter((program) => program.id !== deleteTarget.id),
      );
      if (deleteTarget.source === "saved") {
        setSavedTotalCount((current) => Math.max(0, current - 1));
      }
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
        await savedNoticesApi.setProgress(program.id, status);
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
          <ProgramSortDropdown
            value={sort}
            onChange={setSort}
            variant="myPrograms"
            hiddenOptions={activeFilter === "all" ? [] : ["fit"]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center text-ink-muted" role="status">
          <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
          불러오는 중…
        </div>
      ) : loadError ? (
        <div className="rounded-[12px] bg-transparent px-6 py-16 text-center" role="alert">
          <div className="relative mx-auto mb-2 flex h-[180px] w-[180px] items-center justify-center">
            <img
              src="/assets/empty/error.svg"
              alt=""
              aria-hidden="true"
              draggable={false}
              className="block w-[132px] saturate-[0.1]"
            />
          </div>
          <p className="text-[18px] font-semibold text-ink">일시적으로 불러오지 못했어요.</p>
          <p className="mt-[2px] text-[15px] text-ink-muted">{loadError}</p>
          <Button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="mt-5 h-11 rounded-[10px] bg-[#F2F7F4] px-5 text-[15px] font-semibold text-brand shadow-none transition-colors hover:bg-[#EAF1EC]"
          >
            다시 시도
          </Button>
        </div>
      ) : visiblePrograms.length > 0 ? (
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
        <div className="rounded-[12px] bg-surface px-6 py-16 text-center">
          <div className="relative left-[6px] mx-auto mb-2 h-[81px] w-[79px] origin-top-left scale-[0.53] saturate-[0.1]">
            <img src="/assets/empty/sleep/body.svg" alt="" aria-hidden="true" className="absolute left-0 top-0 max-w-none" />
            <img src="/assets/empty/sleep/zzz.svg" alt="" aria-hidden="true" className="animate-empty-zzz animate-empty-zzz-delay-2 absolute left-[74.46px] top-[21.1px] max-w-none" style={{ clipPath: "inset(0 0 0 44px)" }} />
            <img src="/assets/empty/sleep/zzz.svg" alt="" aria-hidden="true" className="animate-empty-zzz animate-empty-zzz-delay-1 absolute left-[74.46px] top-[21.1px] max-w-none" style={{ clipPath: "inset(0 30px 0 22px)" }} />
            <img src="/assets/empty/sleep/zzz.svg" alt="" aria-hidden="true" className="animate-empty-zzz absolute left-[74.46px] top-[21.1px] max-w-none" style={{ clipPath: "inset(0 52px 0 0)" }} />
            <img src="/assets/empty/sleep/eyes.svg" alt="" aria-hidden="true" className="absolute left-[23.47px] top-[78.81px] max-w-none" />
            <img src="/assets/empty/sleep/mouth.svg" alt="" aria-hidden="true" className="absolute left-[41.17px] top-[94.21px] max-w-none" />
            <img src="/assets/empty/sleep/foot-left.svg" alt="" aria-hidden="true" className="absolute left-[18.07px] top-[114.64px] max-w-none" />
            <img src="/assets/empty/sleep/foot-right.svg" alt="" aria-hidden="true" className="absolute left-[56.38px] top-[114.64px] max-w-none" />
          </div>
          <p className="text-[18px] font-semibold text-ink">저장된 지원사업이 없어요</p>
          <p className="mt-[2px] text-[15px] text-ink-muted">
            지원사업을 탐색하거나 직접 추가해 진행 상황을 관리해 보세요.
          </p>
          <Button
            type="button"
            onClick={() => void navigate({ to: "/programs" })}
            className="mt-5 h-11 rounded-[10px] bg-[#F2F7F4] px-5 text-[15px] font-semibold text-brand shadow-none transition-colors hover:bg-[#EAF1EC]"
          >
            지원사업 탐색하기
          </Button>
        </div>
      ) : (
        <div className="rounded-[12px] bg-surface px-6 py-16 text-center">
          <div className="relative left-[6px] mx-auto mb-2 h-[81px] w-[79px] origin-top-left scale-[0.53] saturate-[0.1]">
            <img src="/assets/empty/sleep/body.svg" alt="" aria-hidden="true" className="absolute left-0 top-0 max-w-none" />
            <img src="/assets/empty/sleep/zzz.svg" alt="" aria-hidden="true" className="animate-empty-zzz animate-empty-zzz-delay-2 absolute left-[74.46px] top-[21.1px] max-w-none" style={{ clipPath: "inset(0 0 0 44px)" }} />
            <img src="/assets/empty/sleep/zzz.svg" alt="" aria-hidden="true" className="animate-empty-zzz animate-empty-zzz-delay-1 absolute left-[74.46px] top-[21.1px] max-w-none" style={{ clipPath: "inset(0 30px 0 22px)" }} />
            <img src="/assets/empty/sleep/zzz.svg" alt="" aria-hidden="true" className="animate-empty-zzz absolute left-[74.46px] top-[21.1px] max-w-none" style={{ clipPath: "inset(0 52px 0 0)" }} />
            <img src="/assets/empty/sleep/eyes.svg" alt="" aria-hidden="true" className="absolute left-[23.47px] top-[78.81px] max-w-none" />
            <img src="/assets/empty/sleep/mouth.svg" alt="" aria-hidden="true" className="absolute left-[41.17px] top-[94.21px] max-w-none" />
            <img src="/assets/empty/sleep/foot-left.svg" alt="" aria-hidden="true" className="absolute left-[18.07px] top-[114.64px] max-w-none" />
            <img src="/assets/empty/sleep/foot-right.svg" alt="" aria-hidden="true" className="absolute left-[56.38px] top-[114.64px] max-w-none" />
          </div>
          <p className="text-[18px] font-semibold text-ink">선택한 진행 상태의 지원사업이 없어요</p>
          <p className="mt-[2px] text-[15px] text-ink-muted">다른 진행 상태를 선택해보세요.</p>
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
                    ? deleteTarget.schedules.every((schedule) => schedule.title === "[접수 마감일]")
                      ? "자동 생성된 마감일도 함께 삭제됩니다."
                      : `연결된 일정 ${deleteTarget.schedules.length}개도 함께 삭제됩니다.`
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
