/**
 * Display helpers.
 */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}

export function fileExtension(name: string): "pdf" | "txt" | "other" {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "txt") return "txt";
  return "other";
}

export function fileIcon(extension: string): string {
  if (extension === "pdf") return "PDF";
  if (extension === "txt" || extension === "md") return "TXT";
  return "DOC";
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Best-effort LaTeX normalization. Kept here for backwards compatibility; the
 * backend prompt already instructs the model to emit valid `$...$` / `$$...$$`
 * markers, so this is a safety net for older models.
 */
export function normalizeMath(content: string): string {
  const latexToken = /\\[A-Za-z]+(?:_{[^}]+}|^{[^}]+}|_[A-Za-z]+|\^[A-Za-z]+|\{[^}]*\})?/g;

  const inlineGroupPatterns = [
    /\(([^()]*\\[A-Za-z]+[^()]*)\)/g,
    /\[([^[\]]*\\[A-Za-z]+[^[\]]*)\]/g,
    /{([^{}]*\\[A-Za-z]+[^{}]*)}/g,
  ];

  let normalized = content;
  for (const pattern of inlineGroupPatterns) {
    normalized = normalized.replace(pattern, (_match, inner: string) => {
      const trimmed = inner.trim();
      if (!trimmed) return _match;
      return `$${trimmed}$`;
    });
  }

  const normalizedLines = normalized.split("\n").map((line) => {
    if (!line || line.includes("$")) return line;

    const trimmed = line.trim();
    if (!trimmed) return line;

    const hasLatex = /\\[A-Za-z]+|[_^]\{/.test(line);
    if (!hasLatex) return line;

    const isListItem = /^\s*[-*]\s+/.test(line);
    if (isListItem) {
      return line.replace(latexToken, (match) => `$${match}$`);
    }

    if (/[=]/.test(line) || trimmed.startsWith("\\") || trimmed.startsWith("|")) {
      return `$$\n${trimmed}\n$$`;
    }

    return line.replace(latexToken, (match) => `$${match}$`);
  });

  return normalizedLines.join("\n").replace(/\$\$(?=\S)/g, "$");
}