import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "개인정보 처리방침" }] }),
  component: () => <LegalDocumentPage kind="privacy" />,
});
