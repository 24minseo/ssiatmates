import { useEffect, useRef, useState } from "react";
import type { SlideTextEdit, TextSelection } from "@/lib/ir-slide-text";

export function SlideTextEditor({
  selection,
  stored,
  palette,
  save,
  close,
}: {
  selection: TextSelection;
  stored: SlideTextEdit;
  palette: (string | null | undefined)[];
  save: (edit: SlideTextEdit) => Promise<void>;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(selection);
  const input = useRef<HTMLTextAreaElement>(null);
  const [colors, setColors] = useState(stored.colors ?? []);
  const [custom, setCustom] = useState("#1f8064");
  function paint(color: string) {
    const field = input.current;
    if (!field || !draft.text.length) return;
    const partial = field.selectionStart !== field.selectionEnd;
    const start = partial ? field.selectionStart : 0;
    const end = partial ? field.selectionEnd : draft.text.length;
    const remaining = colors.flatMap(r => {
      if (r.end <= start || r.start >= end) return [r];
      return [...(r.start < start ? [{ ...r, end: start }] : []),
        ...(r.end > end ? [{ ...r, start: end }] : [])];
    });
    setColors([...remaining, { start, end, color }].sort((a,b) => a.start-b.start));
  }
  function changeText(text: string) {
    const previous = draft.text;
    let left = 0, tail = 0;
    while (left < Math.min(previous.length,text.length) && previous[left] === text[left]) left++;
    while (tail < Math.min(previous.length,text.length)-left &&
      previous[previous.length-1-tail] === text[text.length-1-tail]) tail++;
    const delta = text.length - previous.length;
    setColors(colors.flatMap(r => {
      const pieces = [];
      if (r.start < left) pieces.push({ ...r, end: Math.min(left,r.end) });
      if (r.start < previous.length-tail && r.end > left && r.start <= left &&
          r.end >= previous.length-tail && text.length-tail > left)
        pieces.push({ ...r, start:left, end:text.length-tail });
      if (r.end > previous.length-tail) pieces.push({ ...r, start:Math.max(r.start,previous.length-tail)+delta, end:r.end+delta });
      return pieces;
    }));
    setDraft({ ...draft, text });
  }
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
          if (colors.length || stored.colors?.length) {
            edit.text = draft.text;
            edit.colors = colors;
          }
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
            ref={input}
            required
            maxLength={6000}
            rows={4}
            value={draft.text}
            className="rounded-lg border p-2 font-normal"
            onChange={(e) => changeText(e.target.value)}
          />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-semibold">글자 색상</legend>
          <p className="text-xs text-ink-muted">위에서 단어를 드래그한 뒤 색을 고르세요. 선택한 부분이 없으면 전체에 적용돼요.</p>
          <div className="flex items-center gap-2">
            {Array.from(new Set(palette.filter((c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c)))).map(color =>
              <button key={color} type="button" aria-label={color + " 적용"} title={color}
                className="size-8 rounded border" style={{ backgroundColor: color }}
                onClick={() => paint(color)} />)}
            <input type="color" aria-label="직접 고를 색상" value={custom} onChange={e => setCustom(e.target.value)} />
            <button type="button" className="text-sm" onClick={() => paint(custom)}>선택 색 적용</button>
          </div>
          {colors.length > 0 && <div aria-label="글자 색상 미리보기" className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded border p-2">
            {colors.map((r,i) => <span key={r.start}>{draft.text.slice(colors[i-1]?.end ?? 0,r.start)}<span style={{color:r.color}}>{draft.text.slice(r.start,r.end)}</span></span>)}
            {draft.text.slice(colors[colors.length-1]?.end)}
          </div>}
        </fieldset>
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
