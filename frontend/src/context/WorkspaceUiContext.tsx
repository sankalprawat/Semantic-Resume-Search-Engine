"use client";

import React, { createContext, useContext, useState } from "react";

export type MobileWorkspaceView = "brief" | "inspector";

interface WorkspaceUiContextType {
  isUploadModalOpen: boolean;
  isCreatePoolOpen: boolean;
  mobileView: MobileWorkspaceView;
  isDrawerOpen: boolean;

  setIsUploadModalOpen: (open: boolean) => void;
  setIsCreatePoolOpen: (open: boolean) => void;
  setMobileView: (view: MobileWorkspaceView) => void;
  setIsDrawerOpen: (open: boolean) => void;
}

const WorkspaceUiContext = createContext<WorkspaceUiContextType | undefined>(undefined);

export function WorkspaceUiProvider({ children }: { children: React.ReactNode }) {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);
  const [mobileView, setMobileView] = useState<MobileWorkspaceView>("brief");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <WorkspaceUiContext.Provider
      value={{
        isUploadModalOpen,
        isCreatePoolOpen,
        mobileView,
        isDrawerOpen,
        setIsUploadModalOpen,
        setIsCreatePoolOpen,
        setMobileView,
        setIsDrawerOpen,
      }}
    >
      {children}
    </WorkspaceUiContext.Provider>
  );
}

export function useWorkspaceUi() {
  const ctx = useContext(WorkspaceUiContext);
  if (!ctx) {
    throw new Error("useWorkspaceUi must be used within a WorkspaceUiProvider");
  }
  return ctx;
}
