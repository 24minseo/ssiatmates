import { useEffect, useRef, useState } from "react";
import type { SlideTextEdit, TextSelection } from "@/lib/ir-slide-text";

export function SlideTextEditor({
  selection,
  stored,
  save,
  close,
}: {
  selection: TextSelection;
  stored: SlideTextEdit;
  save: (edit: SlideTextEdit) => Promise<void>;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(selection);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label="텍스트 편집"
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) close();
      }}
      className="fixed inset-0 m-auto w-[min(28rem,94vw)] rounded-xl border border-field-border bg-surface p-5 text-ink shadow-lg backdrop:bg-black/30"
    >
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const edit: SlideTextEdit = { ...stored };
          if (draft.text !== selection.text) edit.text = draft.text;
          if (draft.size !== selection.size) edit.size = draft.size;
          if (draft.bold !== selection.bold) edit.bold = draft.bold;
          if (draft.x !== (stored.x ?? 0)) edit.x = draft.x;
          if (draft.y !== (stored.y ?? 0)) edit.y = draft.y;
          setPending(true);
          try {
            await save(edit);
            close();
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : "저장에 실패했어요.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label className="grid gap-2 font-semibold">
          텍스트 내용
          <textarea
            required
            maxLength={6000}
            rows={4}
            value={draft.text}
            className="rounded-lg border p-2 font-normal"
            onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          {(["size", "x", "y"] as const).map((key) => (
            <label key={key} className="grid gap-1 text-sm">
              {{ size: "크기 (px)", x: "가로 이동 (px)", y: "세로 이동 (px)" }[key]}
              <input
                type="number"
                required
                step="any"
                min={key === "size" ? 1 : -1920}
                max={key === "size" ? 512 : 1920}
                className="w-24 rounded-md border p-2"
                value={Number.isFinite(draft[key]) ? draft[key] : ""}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.valueAsNumber })}
              />
            </label>
          ))}
          <label>
            <input
              type="checkbox"
              checked={draft.bold}
              onChange={(e) => setDraft({ ...draft, bold: e.target.checked })}
            />{" "}
            굵게
          </label>
        </div>
        {error && <p role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={pending} onClick={close}>
            취소
          </button>
          <button disabled={pending} className="rounded-lg bg-brand px-4 py-2 text-white">
            {pending ? "저장 중…" : "저장"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
