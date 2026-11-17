"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "neutral" | "success" | "warning" | "cited";
  size?: "sm" | "md";
  icon?: React.ReactNode;
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  icon,
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center rounded-full font-medium whitespace-nowrap select-none";

  const variantStyles = {
    default:
      "bg-[#F7F6F2] dark:bg-[#262422] border border-[#E6E4DD] dark:border-[#38342F] text-stone-700 dark:text-stone-300",
    neutral:
      "bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300",
    success:
      "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300",
    warning:
      "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300",
    cited:
      "bg-amber-100 dark:bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-400/80 ring-2 ring-amber-300/50 dark:ring-amber-400/20",
  };

  const sizeStyles = {
    sm: "text-[10px] px-2 py-0.5 gap-1",
    md: "text-[11px] px-2.5 py-1 gap-1.5",
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {icon}
      {children}
    </div>
  );
}
