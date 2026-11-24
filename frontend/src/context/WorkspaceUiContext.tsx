"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

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

  const value = useMemo(
    () => ({
      isUploadModalOpen,
      isCreatePoolOpen,
      mobileView,
      isDrawerOpen,
      setIsUploadModalOpen,
      setIsCreatePoolOpen,
      setMobileView,
      setIsDrawerOpen,
    }),
    [isUploadModalOpen, isCreatePoolOpen, mobileView, isDrawerOpen]
  );

  return (
    <WorkspaceUiContext.Provider value={value}>
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
