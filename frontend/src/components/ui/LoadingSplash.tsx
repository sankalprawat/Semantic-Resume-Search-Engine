"use client";

import React, { useEffect, useState } from "react";
import { BrandLogo } from "./BrandLogo";

interface LoadingSplashProps {
  isVisible: boolean;
}

export function LoadingSplash({ isVisible }: LoadingSplashProps) {
  const [shouldRender, setShouldRender] = useState(isVisible);
  const [fadeState, setFadeState] = useState<"visible" | "fading" | "hidden">(
    isVisible ? "visible" : "hidden"
  );

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setFadeState("visible");
    } else {
      setFadeState("fading");
      const timer = setTimeout(() => {
        setFadeState("hidden");
        setShouldRender(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-50 dark:bg-[#121110] select-none transition-opacity duration-300 ease-out ${
        fadeState === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-live="polite"
      aria-busy={isVisible}
    >
      <div className="flex flex-col items-center text-center p-6 max-w-sm">
        {/* Large SVG Brand Logo - Clean, sharp, zero glow */}
        <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center shrink-0 mb-4">
          <BrandLogo size="hero" className="w-full h-full" />
        </div>

        {/* Brand Name */}
        <h1 className="text-base sm:text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100">
          SemanticPin
        </h1>

        {/* Decent, Clean Loading Bar */}
        <div className="w-56 sm:w-64 mt-5">
          <div className="h-1.5 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden relative border border-stone-300/40 dark:border-white/5">
            <div className="absolute inset-y-0 w-2/5 bg-blue-600 dark:bg-blue-500 rounded-full animate-loading-bar" />
          </div>
        </div>

        {/* Status text */}
        <p className="text-[11px] font-medium text-stone-500 dark:text-stone-400 mt-3 tracking-wide">
          Setting up the enviornment...
        </p>
      </div>
    </div>
  );
}
export default LoadingSplash;
