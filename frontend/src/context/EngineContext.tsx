"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  ActiveCitationTarget,
  Candidate,
  EvaluationDonePayload,
  TalentPool,
} from "@/types";
import {
  fetchCandidates,
  fetchPools,
  seedSamplePool,
  streamEvaluation,
} from "@/lib/api";

interface EngineContextType {
  pools: TalentPool[];
  activePool: TalentPool | null;
  candidates: Candidate[];
  activeCandidate: Candidate | null;
  query: string;
  isStreaming: boolean;
  streamedContent: string;
  doneData: EvaluationDonePayload | null;
  streamError: string | null;
  activeCitation: ActiveCitationTarget | null;
  isUploadModalOpen: boolean;
  isCreatePoolOpen: boolean;
  isSeedingSample: boolean;

  // Actions
  setActivePool: (pool: TalentPool | null) => void;
  setActiveCandidate: (cand: Candidate | null) => void;
  setQuery: (q: string) => void;
  setActiveCitation: (cit: ActiveCitationTarget | null) => void;
  setIsUploadModalOpen: (open: boolean) => void;
  setIsCreatePoolOpen: (open: boolean) => void;
  refreshPools: () => Promise<void>;
  refreshCandidates: (poolId: string) => Promise<void>;
  loadSamplePool: () => Promise<void>;
  runSynthesis: (mandateQuery?: string) => Promise<void>;
  clearSynthesis: () => void;
}

const EngineContext = createContext<EngineContextType | undefined>(undefined);

export function EngineProvider({ children }: { children: React.ReactNode }) {
  const [pools, setPools] = useState<TalentPool[]>([]);
  const [activePool, setActivePoolState] = useState<TalentPool | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);

  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedContent, setStreamedContent] = useState("");
  const [doneData, setDoneData] = useState<EvaluationDonePayload | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [activeCitation, setActiveCitation] = useState<ActiveCitationTarget | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);
  const [isSeedingSample, setIsSeedingSample] = useState(false);

  const loadSamplePool = async () => {
    setIsSeedingSample(true);
    try {
      const samplePool = await seedSamplePool();
      await refreshPools();
      setActivePool(samplePool);
    } catch (e) {
      console.error("Failed to load sample talent pool:", e);
    } finally {
      setIsSeedingSample(false);
    }
  };

  const refreshPools = async () => {
    try {
      const data = await fetchPools();
      setPools(data);
      if (data.length > 0 && !activePool) {
        setActivePoolState(data[0]);
      }
    } catch (e) {
      console.error("Error refreshing pools:", e);
    }
  };

  const refreshCandidates = async (poolId: string) => {
    try {
      const data = await fetchCandidates(poolId);
      setCandidates(data);
      if (data.length > 0) {
        setActiveCandidate(data[0]);
      } else {
        setActiveCandidate(null);
      }
    } catch (e) {
      console.error("Error refreshing candidates:", e);
      setCandidates([]);
      setActiveCandidate(null);
    }
  };

  const setActivePool = (pool: TalentPool | null) => {
    setActivePoolState(pool);
    clearSynthesis();
    if (pool) {
      refreshCandidates(pool.id);
    } else {
      setCandidates([]);
      setActiveCandidate(null);
    }
  };

  useEffect(() => {
    refreshPools();
  }, []);

  useEffect(() => {
    if (activePool) {
      refreshCandidates(activePool.id);
    }
  }, [activePool?.id]);

  const clearSynthesis = () => {
    setIsStreaming(false);
    setStreamedContent("");
    setDoneData(null);
    setStreamError(null);
    setActiveCitation(null);
  };

  const runSynthesis = async (mandateQuery?: string) => {
    const q = mandateQuery ?? query;
    if (!activePool || !q.trim() || isStreaming) return;

    clearSynthesis();
    setIsStreaming(true);

    await streamEvaluation(
      activePool.id,
      q.trim(),
      (token) => {
        setStreamedContent((prev) => prev + token);
      },
      (donePayload) => {
        setDoneData(donePayload);
        setIsStreaming(false);
      },
      (err) => {
        setStreamError(err);
        setIsStreaming(false);
      }
    );
  };

  return (
    <EngineContext.Provider
      value={{
        pools,
        activePool,
        candidates,
        activeCandidate,
        query,
        isStreaming,
        streamedContent,
        doneData,
        streamError,
        activeCitation,
        isUploadModalOpen,
        isCreatePoolOpen,
        isSeedingSample,
        setActivePool,
        setActiveCandidate,
        setQuery,
        setActiveCitation,
        setIsUploadModalOpen,
        setIsCreatePoolOpen,
        refreshPools,
        refreshCandidates,
        loadSamplePool,
        runSynthesis,
        clearSynthesis,
      }}
    >
      {children}
    </EngineContext.Provider>
  );
}

export function useEngine() {
  const ctx = useContext(EngineContext);
  if (!ctx) {
    throw new Error("useEngine must be used within an EngineProvider");
  }
  return ctx;
}
