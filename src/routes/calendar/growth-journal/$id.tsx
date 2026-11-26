import { ArrowLeft, ArrowUp, Download, Loader2 } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createElement, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/ui/loading-dots";
import { supabase } from "@/integrations/supabase/client";

const JOURNAL_IMAGE_BUCKET = "growth-journal-images";
const isImageStoragePath = (path: string) => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(path);

function FileInsertIcon({ className }: { className?: string }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M12 2V7C12 7.44313 11.9982 7.87603 12.0459 8.23047C12.0974 8.61367 12.2227 9.05085 12.5859 9.41406C12.9492 9.77728 13.3863 9.90258 13.7695 9.9541C14.124 10.0018 14.5569 10 15 10H20V16C20 18.8284 19.9998 20.2424 19.1211 21.1211C18.2424 21.9998 16.8284 22 14 22H10C7.17157 22 5.75759 21.9998 4.87891 21.1211C4.00023 20.2424 4 18.8284 4 16V8C4 5.17157 4.00023 3.75759 4.87891 2.87891C5.75759 2.00023 7.17157 2 10 2H12ZM14 2.00586C14.4115 2.01605 14.6837 2.0477 14.9365 2.15234C15.3041 2.30458 15.5938 2.59381 16.1719 3.17188L18.8281 5.82812C19.4062 6.40619 19.6954 6.69593 19.8477 7.06348C19.9523 7.31627 19.983 7.58856 19.9932 8H15C14.5005 8 14.2263 7.9982 14.0361 7.97266C14.0335 7.9723 14.0308 7.97106 14.0283 7.9707C14.028 7.96853 14.0276 7.96612 14.0273 7.96387C14.0018 7.77368 14 7.4995 14 7V2.00586Z" fill="currentColor" />
  </svg>;
}
const allowedTags = new Set([
  "P",
  "H2",
  "H3",
  "STRONG",
  "B",
  "EM",
  "I",
  "S",
  "U",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "HR",
  "BR",
  "A",
  "IMG",
]);

function safeUrl(value: string | null, image = false) {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    if (image && (url.protocol === "https:" || url.protocol === "http:")) return url.href;
    if (!image && ["https:", "http:", "mailto:"].includes(url.protocol)) return url.href;
  } catch {
    return undefined;
  }
  return undefined;
}

function renderSafeNode(node: Node, key: string): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent;
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as HTMLElement;
  const tag = element.tagName.toUpperCase();
  const children = Array.from(element.childNodes).map((child, index) =>
    renderSafeNode(child, `${key}-${index}`),
  );
  if (!allowedTags.has(tag)) return children;
  if (tag === "HR") return <hr key={key} />;
  if (tag === "BR") return <br key={key} />;
  if (tag === "A") {
    return createElement(
      "a",
      { key, href: safeUrl(element.getAttribute("href")), rel: "noreferrer" },
      children,
    );
  }
  if (tag === "IMG") {
    const src = safeUrl(element.getAttribute("src"), true);
    return src ? <img key={key} src={src} alt={element.getAttribute("alt") ?? ""} /> : null;
  }
  return createElement(tag.toLowerCase(), { key }, children);
}

function renderSafeHtml(html: string) {
  if (typeof DOMParser === "undefined") return null;
  const document = new DOMParser().parseFromString(html, "text/html");
  return Array.from(document.body.childNodes).map((node, index) =>
    renderSafeNode(node, `content-${index}`),
  );
}

export const Route = createFileRoute("/calendar/growth-journal/$id")({
  head: () => ({ meta: [{ title: "성장일지" }] }),
  component: GrowthJournalDetailPage,
});

function GrowthJournalDetailPage() {
  const { id } = Route.useParams();
  const [entry, setEntry] = useState<{
    diary_date: string;
    title: string;
    content: string | null;
    tags: string[];
    image_paths: string[];
  } | null>(null);
  const [content, setContent] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const scrollContainer = document.querySelector("main");
    if (!scrollContainer) return;
    const handleScroll = () => setShowBackToTop(scrollContainer.scrollTop > 120);
    handleScroll();
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEntry = async () => {
      const { data, error: loadError } = await supabase
        .from("startup_diaries")
        .select("diary_date, title, content, tags, image_paths")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (loadError || !data) {
        setError("성장일지를 불러오지 못했어요.");
        return;
      }

      let hydratedContent = data.content ?? "";
      const nextAttachmentUrls: Record<string, string> = {};
      for (const path of data.image_paths) {
        const { data: signedUrlData } = await supabase.storage
          .from(JOURNAL_IMAGE_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (signedUrlData?.signedUrl) {
          if (!isImageStoragePath(path)) nextAttachmentUrls[path] = signedUrlData.signedUrl;
          hydratedContent = hydratedContent
            .split(`storage://${path}`)
            .join(signedUrlData.signedUrl);
        }
      }
      if (cancelled) return;
      setEntry(data);
      setContent(hydratedContent);
      setAttachmentUrls(nextAttachmentUrls);
    };
    void loadEntry();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) return <p className="py-16 text-center text-[16px] text-destructive">{error}</p>;
  if (!entry)
    return (
      <div className="flex min-h-[240px] items-center justify-center py-16 text-ink-muted" role="status">
        <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
        <>불러오는 중이에요<LoadingDots /></>
      </div>
    );

  return (
    <section className="mx-auto w-full max-w-[960px] pb-16">
      <div className="mt-8 flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          className="size-10 rounded-[8px] px-0 text-ink-muted hover:bg-item-hover hover:text-ink"
        >
          <Link to="/calendar/growth-journal" aria-label="성장일지 목록으로 돌아가기">
            <ArrowLeft className="size-5" strokeWidth={2} />
          </Link>
        </Button>
        <span aria-hidden="true" className="h-6 w-px bg-field-border" />
        <time className="px-1 text-[15px] font-semibold text-ink">
          {entry.diary_date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1.$2.$3")}
        </time>
        <Button
          asChild
          variant="ghost"
          className="ml-auto h-11 min-w-[88px] rounded-[12px] bg-secondary-btn px-5 text-[15px] font-semibold text-secondary-btn-text shadow-none hover:bg-secondary-btn-hover hover:text-secondary-btn-text-hover"
        >
          <Link
            to="/calendar/growth-journal/new"
            search={{ id, date: entry.diary_date, from: "detail", returnId: id }}
          >
            수정하기
          </Link>
        </Button>
      </div>
      <article className="mt-10">
        <h1 className="text-[28px] font-bold leading-9 text-ink">{entry.title}</h1>
        {entry.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-8 items-center rounded-[4px] bg-[#f5f5f5] px-2 text-[16px] font-medium text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-6 border-t border-field-border pt-6 text-[16px] leading-7 text-ink [&_a]:text-brand [&_a]:underline [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand/30 [&_blockquote]:pl-4 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[24px] [&_h2]:font-bold [&_h2]:leading-8 [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:leading-7 [&_hr]:my-6 [&_hr]:border-field-border/60 [&_img]:my-5 [&_img]:max-h-[520px] [&_img]:max-w-full [&_img]:rounded-[12px] [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_s]:decoration-ink-muted [&_ul]:list-disc [&_ul]:pl-6 [&_u]:underline">
          {renderSafeHtml(content)}
        </div>
        {Object.keys(attachmentUrls).length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2" aria-label="첨부 파일">
            {Object.entries(attachmentUrls).map(([path, url]) => (
              <div
                key={path}
                className="group inline-flex h-8 max-w-[360px] items-center gap-2 rounded-[4px] bg-[#f5f5f5] px-3 text-[14px] font-medium text-ink-muted hover:bg-secondary-btn-hover"
              >
                <FileInsertIcon className="size-4 shrink-0 text-icon-muted transition-colors group-hover:text-ink" />
                <a href={url} target="_blank" rel="noreferrer" className="min-w-0 max-w-[220px] truncate text-ink-muted hover:text-ink">
                  {path.split("/").pop()?.replace(/^[^-]+-/, "") || path}
                </a>
                <a href={url} download={path.split("/").pop() || "첨부파일"} aria-label="파일 다운로드" title="다운로드" className="inline-flex size-6 shrink-0 items-center justify-center rounded-[4px] text-icon-muted hover:bg-item-hover hover:text-ink">
                  <Download aria-hidden="true" className="size-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </article>
      <button
        type="button"
        aria-label="맨 위로 이동"
        onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-[80px] right-[52px] z-40 flex size-[52px] items-center justify-center rounded-full bg-surface text-icon-muted shadow-dropdown transition-[opacity,transform,visibility] duration-200 hover:bg-item-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none ${showBackToTop ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"}`}
      >
        <ArrowUp aria-hidden="true" className="size-6" strokeWidth={2} />
      </button>
    </section>
  );
}
