"use client";

import React from "react";
import { PoolDataProvider, usePoolData } from "./PoolDataContext";
import { SynthesisProvider, useSynthesis } from "./SynthesisContext";
import { WorkspaceUiProvider, useWorkspaceUi } from "./WorkspaceUiContext";

export { usePoolData } from "./PoolDataContext";
export { useSynthesis } from "./SynthesisContext";
export { useWorkspaceUi } from "./WorkspaceUiContext";

export function EngineProvider({ children }: { children: React.ReactNode }) {
  return (
    <PoolDataProvider>
      <SynthesisProvider>
        <WorkspaceUiProvider>{children}</WorkspaceUiProvider>
      </SynthesisProvider>
    </PoolDataProvider>
  );
}

/**
 * Composite convenience hook providing backward compatibility for existing components.
 * To optimize performance and eliminate streaming re-render cascades, components can also
 * directly consume usePoolData(), useSynthesis(), or useWorkspaceUi().
 */
export function useEngine() {
  const poolData = usePoolData();
  const synthesis = useSynthesis();
  const workspaceUi = useWorkspaceUi();

  return {
    ...poolData,
    ...synthesis,
    ...workspaceUi,
  };
}
