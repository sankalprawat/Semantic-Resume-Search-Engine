"use client";

import React from "react";
import { EngineProvider } from "@/context/EngineContext";
import { Header } from "@/components/layout/Header";
import { SplitPane } from "@/components/layout/SplitPane";
import { CreatePoolModal } from "@/components/pool/CreatePoolModal";
import { ResumeDropzoneModal } from "@/components/upload/ResumeDropzoneModal";

export default function Home() {
  return (
    <EngineProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-surface-50 font-sans antialiased text-ink-primary">
        <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-3.5 gap-3">
          <Header />
          <SplitPane />
        </div>
        <CreatePoolModal />
        <ResumeDropzoneModal />
      </div>
    </EngineProvider>
  );
}
