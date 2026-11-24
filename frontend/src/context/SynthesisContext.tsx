"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ActiveCitationTarget, EvaluationDonePayload } from "@/types";
import { streamEvaluation } from "@/lib/api";
import { usePoolData } from "./PoolDataContext";

interface SynthesisContextType {
  query: string;
  isStreaming: boolean;
  streamedContent: string;
  doneData: EvaluationDonePayload | null;
  streamError: string | null;
  activeCitation: ActiveCitationTarget | null;

  setQuery: (q: string) => void;
  setActiveCitation: (cit: ActiveCitationTarget | null) => void;
  runSynthesis: (mandateQuery?: string) => Promise<void>;
  clearSynthesis: () => void;
}

const SynthesisContext = createContext<SynthesisContextType | undefined>(undefined);

export function SynthesisProvider({ children }: { children: React.ReactNode }) {
  const { activePool } = usePoolData();

  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [doneData, setDoneData] = useState<EvaluationDonePayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<ActiveCitationTarget | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const clearSynthesis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setStreamedContent("");
    setDoneData(null);
    setStreamError(null);
    setActiveCitation(null);
  }, []);

  // When active pool changes, cleanly abort active streams and clear past synthesis
  useEffect(() => {
    clearSynthesis();
  }, [activePool?.id, clearSynthesis]);

  const runSynthesis = async (mandateQuery?: string) => {
    const q = mandateQuery ?? query;
    if (!activePool || !q.trim() || isStreaming) return;

    clearSynthesis();
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    await streamEvaluation(
      activePool.id,
      q.trim(),
      (token) => {
        setStreamedContent((prev) => prev + token);
      },
      (donePayload) => {
        setDoneData(donePayload);
        setIsStreaming(false);
        abortControllerRef.current = null;
      },
      (err) => {
        if (!controller.signal.aborted) {
          setStreamError(err);
          setIsStreaming(false);
          abortControllerRef.current = null;
        }
      },
      controller.signal
    );
  };

  return (
    <SynthesisContext.Provider
      value={{
        query,
        isStreaming,
        streamedContent,
        doneData,
        streamError,
        activeCitation,
        setQuery,
        setActiveCitation,
        runSynthesis,
        clearSynthesis,
      }}
    >
      {children}
    </SynthesisContext.Provider>
  );
}

export function useSynthesis() {
  const ctx = useContext(SynthesisContext);
  if (!ctx) {
    throw new Error("useSynthesis must be used within a SynthesisProvider");
  }
  return ctx;
}
