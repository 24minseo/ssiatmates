import { ArrowLeft, ArrowUp, Loader2 } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createElement, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const JOURNAL_IMAGE_BUCKET = "growth-journal-images";
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
      for (const path of data.image_paths) {
        const { data: signedUrlData } = await supabase.storage
          .from(JOURNAL_IMAGE_BUCKET)
          .createSignedUrl(path, 60 * 60);
        if (signedUrlData?.signedUrl) {
          hydratedContent = hydratedContent
            .split(`storage://${path}`)
            .join(signedUrlData.signedUrl);
        }
      }
      if (cancelled) return;
      setEntry(data);
      setContent(hydratedContent);
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
        불러오는 중이에요…
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
