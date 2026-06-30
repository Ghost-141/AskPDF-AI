/**
 * Shared types for the PDF-QA frontend.
 */

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
}

export interface SourceChunk {
  chunk_id: string;
  page?: number | null;
  section?: string | null;
  snippet: string;
  score?: number;
}

export interface DocumentInfo {
  id: string;            // stable id (e.g. filename)
  name: string;          // display name (e.g. "q3_report.pdf")
  extension: "pdf" | "txt";
  sizeBytes: number;
  chunks: number;        // 0 while processing
  uploadedAt: string;    // ISO timestamp
}

export interface UploadResponse {
  filename: string;
}

export interface ProcessFileResponse {
  message: string;
  num_docs?: number;
}

export interface AnswerResponse {
  answer: string;
  sources?: SourceChunk[];
}

export type StatusVariant = "idle" | "loading" | "success" | "error";
export type DocStatus = "uploading" | "processing" | "ready" | "error";