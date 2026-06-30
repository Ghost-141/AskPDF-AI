"use client";

import type { DocumentInfo, StatusVariant } from "@/lib/types";

import { ThemeToggle } from "./ThemeToggle";

interface ChatHeaderProps {
  document: DocumentInfo | null;
  isReady: boolean;
  status: { message: string; variant: StatusVariant } | null;
}

function statusToPill(variant: StatusVariant | undefined, isReady: boolean) {
  if (variant === "loading") return "processing";
  if (variant === "error") return "error";
  if (isReady) return "ready";
  return undefined;
}

function pillLabel(variant: StatusVariant | undefined, isReady: boolean, docName: string | null) {
  if (variant === "loading") return "Working…";
  if (variant === "error") return "Error";
  if (isReady) return "Ready";
  if (docName) return "Processing";
  return "Idle";
}

export function ChatHeader({ document, isReady, status }: ChatHeaderProps) {
  const variant = statusToPill(status?.variant, isReady);
  const label = pillLabel(status?.variant, isReady, document?.name ?? null);

  return (
    <header className="chat-header" role="banner">
      <div className="chat-header-titles">
        <span className="chat-header-title">
          {document ? document.name : "Document QA Workspace"}
        </span>
        <span className={`chat-header-subtitle ${document ? "" : "empty"}`}>
          {document
            ? `${document.chunks} chunk${document.chunks === 1 ? "" : "s"} indexed`
            : "Select a document from the sidebar to get started."}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {document ? <span className={`status-pill ${variant ?? ""}`}>{label}</span> : null}
        <ThemeToggle />
      </div>
    </header>
  );
}