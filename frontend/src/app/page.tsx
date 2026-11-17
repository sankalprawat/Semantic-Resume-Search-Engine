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
      <div className="flex flex-col min-h-dvh md:h-screen overflow-x-hidden md:overflow-hidden bg-surface-50 dark:bg-[#121110] font-sans antialiased text-ink-primary dark:text-[#F5F4F0] transition-colors duration-200">
        <div className="flex flex-col h-full w-full max-w-7xl mx-auto px-2.5 py-2 sm:px-4 sm:py-2.5 gap-2.5 flex-1 min-h-0">
          <Header />
          <SplitPane />
        </div>
        <CreatePoolModal />
        <ResumeDropzoneModal />
      </div>
    </EngineProvider>
  );
}
