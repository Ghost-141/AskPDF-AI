"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage } from "@/lib/types";

import { MarkdownMessage } from "./MarkdownMessage";

interface ChatThreadProps {
  messages: ChatMessage[];
  isReady: boolean;
  isAsking: boolean;
  activeDocumentName: string | null;
}

export function ChatThread({ messages, isReady, isAsking, activeDocumentName }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="chat-thread" role="log" aria-live="polite" aria-label="Conversation">
      <div className="chat-thread-inner">
        {messages.length === 0 ? (
          <EmptyState isReady={isReady} documentName={activeDocumentName} isAsking={isAsking} />
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`bubble bubble-${message.role}`}
            >
              <span className="bubble-role">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
              <div className="bubble-content">
                {message.role === "assistant" && message.content === "" ? (
                  <TypingDots />
                ) : (
                  <MarkdownMessage content={message.content} />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EmptyState({
  isReady,
  documentName,
  isAsking,
}: {
  isReady: boolean;
  documentName: string | null;
  isAsking: boolean;
}) {
  if (!documentName) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <h2>No document selected</h2>
        <p>
          Upload a PDF or text file from the sidebar to start asking
          questions about its contents.
        </p>
      </div>
    );
  }

  if (isAsking) {
    return (
      <div className="empty-state">
        <span className="empty-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <h2>Thinking…</h2>
        <p>Looking through <em>{documentName}</em> for an answer.</p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </span>
      <h2>Ready when you are</h2>
      <p>
        Ask anything about <em>{documentName}</em>. The assistant will answer
        strictly from the document, with math, tables, and code rendered
        cleanly.
      </p>
    </div>
  );
}

function TypingDots() {
  return (
    <span
      style={{
        display: "inline-flex",
        gap: "0.25rem",
        padding: "0.25rem 0",
      }}
      aria-label="Assistant is typing"
    >
      <Dot delay={0} />
      <Dot delay={150} />
      <Dot delay={300} />
    </span>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: "var(--ink-faint)",
        animation: "pulse 1.2s ease-in-out infinite",
        animationDelay: `${delay}ms`,
      }}
    />
  );
}