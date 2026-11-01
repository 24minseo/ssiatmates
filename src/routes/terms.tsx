import { createFileRoute } from "@tanstack/react-router";

import { LegalDocumentPage } from "@/components/legal/LegalDocumentPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "이용약관" }] }),
  component: () => <LegalDocumentPage kind="terms" />,
});
