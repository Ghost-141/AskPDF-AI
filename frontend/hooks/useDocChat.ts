"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiAsk, apiProcess, apiUpload } from "@/lib/api";
import { fileExtension, formatBytes, normalizeMath } from "@/lib/format";
import type {
  ChatMessage,
  DocumentInfo,
  StatusVariant,
} from "@/lib/types";

interface UploadStatus {
  message: string;
  variant: StatusVariant;
}

interface UseDocChat {
  documents: DocumentInfo[];
  activeDocumentId: string | null;
  activeDocument: DocumentInfo | null;
  messages: ChatMessage[];
  isUploading: boolean;
  isProcessing: boolean;
  isAsking: boolean;
  isReady: boolean;
  status: UploadStatus | null;
  upload: (file: File) => Promise<void>;
  selectDocument: (id: string) => void;
  ask: (query: string) => Promise<void>;
  clearActive: () => void;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useDocChat(): UseDocChat {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const [readyIds, setReadyIds] = useState<Set<string>>(new Set());
  const inputKeyRef = useRef(0);

  const activeDocument = useMemo(
    () => documents.find((d) => d.id === activeDocumentId) ?? null,
    [documents, activeDocumentId]
  );

  const isReady = activeDocumentId !== null && readyIds.has(activeDocumentId);

  // Clear chat when the active document changes; the QA pipeline is
  // re-keyed by the backend per upload.
  useEffect(() => {
    setMessages([]);
  }, [activeDocumentId]);

  const setVariant = useCallback((variant: StatusVariant, message: string) => {
    setStatus({ message, variant });
  }, []);

  const upload = useCallback(
    async (file: File) => {
      const ext = fileExtension(file.name);
      if (ext === "other") {
        setVariant("error", "Please choose a PDF or text file.");
        return;
      }

      setIsUploading(true);
      setVariant("loading", "Uploading file…");
      inputKeyRef.current += 1;

      try {
        const { filename } = await apiUpload(file);
        const id = filename;

        const newDoc: DocumentInfo = {
          id,
          name: filename,
          extension: ext as "pdf" | "txt",
          sizeBytes: file.size,
          chunks: 0,
          uploadedAt: new Date().toISOString(),
        };
        setDocuments((prev) => [...prev.filter((d) => d.id !== id), newDoc]);
        setActiveDocumentId(id);
        setReadyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        setIsUploading(false);
        setIsProcessing(true);
        setVariant("loading", "Indexing document…");

        const { num_docs } = await apiProcess(filename);
        setDocuments((prev) =>
          prev.map((d) => (d.id === id ? { ...d, chunks: num_docs ?? 0 } : d))
        );
        setReadyIds((prev) => new Set(prev).add(id));
        setVariant(
          "success",
          `Indexed ${num_docs ?? 0} chunk${(num_docs ?? 0) === 1 ? "" : "s"} from “${filename}”. Ready for questions.`
        );
      } catch (err) {
        setVariant(
          "error",
          err instanceof Error ? err.message : "File processing failed."
        );
      } finally {
        setIsUploading(false);
        setIsProcessing(false);
      }
    },
    [setVariant]
  );

  const selectDocument = useCallback((id: string) => {
    setActiveDocumentId(id);
    setStatus(null);
  }, []);

  const ask = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || !activeDocumentId || !readyIds.has(activeDocumentId)) {
        return;
      }
      setIsAsking(true);
      setStatus(null);

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const data = await apiAsk(trimmed);
        const raw =
          typeof data.answer === "string"
            ? data.answer
            : JSON.stringify(data.answer, null, 2);
        const content = normalizeMath(raw);
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", content },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content:
              err instanceof Error
                ? `I encountered an error: ${err.message}`
                : "I encountered an unexpected error.",
          },
        ]);
      } finally {
        setIsAsking(false);
      }
    },
    [activeDocumentId, readyIds]
  );

  const clearActive = useCallback(() => {
    setActiveDocumentId(null);
    setMessages([]);
    setStatus(null);
  }, []);

  return {
    documents,
    activeDocumentId,
    activeDocument,
    messages,
    isUploading,
    isProcessing,
    isAsking,
    isReady,
    status,
    upload,
    selectDocument,
    ask,
    clearActive,
  };
}

export { formatBytes };