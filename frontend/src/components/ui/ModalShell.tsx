"use client";

import React, { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  maxWidth?: string;
  className?: string;
}

export function ModalShell({
  isOpen,
  onClose,
  children,
  disabled = false,
  maxWidth = "max-w-md",
  className,
}: ModalShellProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabled) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, disabled, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 frosted-glass-overlay animate-in fade-in duration-200"
      onClick={() => {
        if (!disabled) onClose();
      }}
    >
      <div
        className={cn(
          "w-full p-6 frosted-glass-modal animate-in zoom-in-95 duration-200",
          maxWidth,
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
