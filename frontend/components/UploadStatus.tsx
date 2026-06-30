"use client";

import type { StatusVariant } from "@/lib/types";

interface UploadStatusProps {
  message: string;
  variant: StatusVariant;
}

export function UploadStatus({ message, variant }: UploadStatusProps) {
  if (!message) return null;

  return (
    <div
      className={`upload-status ${variant === "idle" ? "" : variant}`}
      role="status"
      aria-live="polite"
    >
      {variant === "loading" ? <span className="spinner" aria-hidden="true" /> : null}
      {variant === "success" ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : null}
      {variant === "error" ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : null}
      <span>{message}</span>
    </div>
  );
}