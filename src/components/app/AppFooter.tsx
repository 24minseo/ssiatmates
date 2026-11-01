export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-field-border py-5 text-[13px] text-[#68716D]">
      <div className="mx-auto flex w-full max-w-[1208px] items-center gap-6 px-6">
        <img
          src="/assets/sidebar/ssiat-logo.svg"
          alt="SSIAT"
          className="h-3 w-auto brightness-0 opacity-50"
        />
        <nav aria-label="서비스 안내" className="flex items-center gap-3">
          <a
            className="font-semibold text-[#454B48] transition-colors hover:text-[#303634]"
            href="/privacy"
          >
            개인정보 처리방침
          </a>
          <span aria-hidden className="text-[11px] leading-none text-field-border">
            |
          </span>
          <a className="transition-colors hover:text-[#454B48]" href="/terms">
            이용약관
          </a>
          <span aria-hidden className="text-[11px] leading-none text-field-border">
            |
          </span>
          <a className="transition-colors hover:text-[#454B48]" href="/feedback">
            피드백 남기기
          </a>
        </nav>
        <p>© 2026 SSIAT. All rights reserved.</p>
      </div>
    </footer>
  );
}
