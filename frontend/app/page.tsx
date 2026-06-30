"use client";

import { ChatComposer } from "@/components/ChatComposer";
import { ChatHeader } from "@/components/ChatHeader";
import { ChatThread } from "@/components/ChatThread";
import { Sidebar } from "@/components/Sidebar";
import { UploadStatus } from "@/components/UploadStatus";
import { useDocChat } from "@/hooks/useDocChat";

export default function Home() {
  const chat = useDocChat();

  return (
    <div className="app-shell">
      <Sidebar
        documents={chat.documents}
        activeDocumentId={chat.activeDocumentId}
        onSelectDocument={chat.selectDocument}
        onUpload={chat.upload}
        isUploading={chat.isUploading}
        isProcessing={chat.isProcessing}
        disabled={chat.isUploading || chat.isProcessing}
      />

      <main className="chat-pane">
        <ChatHeader
          document={chat.activeDocument}
          isReady={chat.isReady}
          status={chat.status}
        />

        {chat.status?.variant && chat.status.variant !== "idle" && chat.activeDocument ? (
          <div style={{ padding: "0.75rem 2rem 0" }}>
            <UploadStatus message={chat.status.message} variant={chat.status.variant} />
          </div>
        ) : null}

        <ChatThread
          messages={chat.messages}
          isReady={chat.isReady}
          isAsking={chat.isAsking}
          activeDocumentName={chat.activeDocument?.name ?? null}
        />

        <ChatComposer
          onSubmit={chat.ask}
          disabled={!chat.isReady}
          isAsking={chat.isAsking}
        />
      </main>
    </div>
  );
}