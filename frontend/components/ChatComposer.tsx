"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";

interface ChatComposerProps {
  onSubmit: (query: string) => void | Promise<void>;
  disabled: boolean;
  isAsking: boolean;
}

export function ChatComposer({ onSubmit, disabled, isAsking }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-grow up to ~6 lines.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, [value]);

  const sendDisabled = disabled || !value.trim() || isAsking;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        if (!sendDisabled) formRef.current?.requestSubmit();
      }
    },
    [sendDisabled]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || sendDisabled) return;
    setValue("");
    await onSubmit(trimmed);
  };

  return (
    <form ref={formRef} className="composer" onSubmit={handleSubmit}>
      <div className="composer-inner">
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          placeholder={
            disabled
              ? "Upload a document to start asking questions…"
              : "Ask a question about your document…"
          }
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          aria-label="Ask a question"
        />
        <button
          type="submit"
          className="composer-send"
          disabled={sendDisabled}
          aria-label="Send question"
        >
          {isAsking ? (
            <>
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid currentColor",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
                aria-hidden="true"
              />
              <span>Sending</span>
            </>
          ) : (
            <>
              <span>Send</span>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
      <p className="composer-hint">
        Press <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
      </p>
    </form>
  );
}