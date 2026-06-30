"use client";

import { useRef } from "react";

import type { DocumentInfo } from "@/lib/types";
import { fileIcon, formatRelativeTime } from "@/lib/format";

interface SidebarProps {
  documents: DocumentInfo[];
  activeDocumentId: string | null;
  onSelectDocument: (id: string) => void;
  onUpload: (file: File) => void | Promise<void>;
  isUploading: boolean;
  isProcessing: boolean;
  disabled: boolean;
}

export function Sidebar({
  documents,
  activeDocumentId,
  onSelectDocument,
  onUpload,
  isUploading,
  isProcessing,
  disabled,
}: SidebarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => inputRef.current?.click();

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await onUpload(file);
    }
    // Reset so the same file can be re-picked.
    if (inputRef.current) inputRef.current.value = "";
  };

  const busy = isUploading || isProcessing;

  return (
    <aside className="sidebar" aria-label="Documents">
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true">P</span>
          <span>AskPDF AI</span>
        </div>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-section-title">
          Documents {documents.length > 0 ? `(${documents.length})` : ""}
        </span>

        <div className="sidebar-list" role="list">
          {documents.length === 0 ? (
            <div className="sidebar-empty">
              No documents yet. Upload a PDF or text file below.
            </div>
          ) : (
            documents.map((doc) => {
              const isActive = doc.id === activeDocumentId;
              return (
                <button
                  key={doc.id}
                  type="button"
                  role="listitem"
                  className={`doc-item ${isActive ? "doc-item--active" : ""}`}
                  onClick={() => onSelectDocument(doc.id)}
                  aria-current={isActive ? "true" : undefined}
                  title={doc.name}
                >
                  <span className="doc-item-icon" aria-hidden="true">
                    {fileIcon(doc.extension)}
                  </span>
                  <span className="doc-item-body">
                    <span className="doc-item-name">{doc.name}</span>
                    <span className="doc-item-meta">
                      {doc.chunks > 0
                        ? `${doc.chunks} chunk${doc.chunks === 1 ? "" : "s"} · ${formatRelativeTime(doc.uploadedAt)}`
                        : `Uploaded ${formatRelativeTime(doc.uploadedAt)}`}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="upload-button"
          onClick={handlePick}
          disabled={disabled || busy}
          aria-label="Upload a new document"
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <span>
                {isUploading ? "Uploading…" : "Indexing…"}
              </span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Upload document</span>
            </>
          )}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          onChange={handleChange}
          style={{ display: "none" }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </aside>
  );
}