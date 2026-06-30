"use client";

import React, { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface MarkdownMessageProps {
  content: string;
}

interface CodeChildProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Detect whether a code block's contents are actually a multi-line code
 * fence (vs. an inline `code` somewhere that got bundled inside <pre>).
 * react-markdown v9 dropped the `inline` prop, so we infer it from the
 * presence of newlines or a `language-*` class.
 */
function looksLikeCodeBlock(children: ReactNode): boolean {
  if (typeof children === "string") {
    return children.includes("\n") || children.length > 80;
  }
  if (Array.isArray(children)) {
    return children.some((child) => looksLikeCodeBlock(child));
  }
  return false;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      className="markdown-content"
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ className, children, ...props }: CodeChildProps) {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock =
            Boolean(match) || looksLikeCodeBlock(children);

          if (!isBlock) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          // Flatten the children to a plain string.
          const text = flatten(children).replace(/\n$/, "");
          return (
            <CodeBlock
              language={match?.[1] ?? "text"}
              value={text}
            />
          );
        },
        // Wrap block-level code in a labeled, copyable container.
        pre({ children }) {
          // We already render our own <pre> inside <CodeBlock> when the
          // inner <code> is a fenced block. For other <pre> usages
          // (e.g. raw HTML) we keep a minimal wrapper.
          if (
            isValidElement(children) &&
            (children as { type?: { name?: string } }).type?.name === "CodeBlock"
          ) {
            return <>{children}</>;
          }
          return <pre className="code-block-pre">{children}</pre>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function flatten(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flatten).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return flatten(props.children);
  }
  return "";
}

interface CodeBlockProps {
  language: string;
  value: string;
}

function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no-op; clipboard may be unavailable */
    }
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language}</span>
        <button
          type="button"
          className={`code-block-copy ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy code to clipboard"}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{value}</code>
      </pre>
    </div>
  );
}