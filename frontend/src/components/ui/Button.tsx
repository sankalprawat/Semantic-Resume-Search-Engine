"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "subtle" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "secondary",
      size = "md",
      loading = false,
      icon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-full transition-all cursor-pointer whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed select-none";

    const variantStyles = {
      primary:
        "bg-stone-900 dark:bg-amber-500 text-white dark:text-stone-950 hover:bg-stone-800 dark:hover:bg-amber-400 border border-stone-900 dark:border-amber-500 shadow-xs",
      secondary:
        "bg-white dark:bg-[#262422] hover:bg-stone-50 dark:hover:bg-[#2F2C29] text-stone-900 dark:text-stone-100 border border-[#E6E4DD] dark:border-[#38342F] hover:border-stone-300 shadow-2xs",
      subtle:
        "bg-[#F7F6F2] dark:bg-[#262422] hover:bg-stone-200/70 dark:hover:bg-[#2F2C29] border border-[#E6E4DD] dark:border-[#38342F] text-stone-800 dark:text-stone-200 shadow-2xs",
      ghost:
        "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100/80 dark:hover:bg-white/10",
    };

    const sizeStyles = {
      sm: "text-[11px] px-2.5 py-1 min-h-[30px] gap-1",
      md: "text-xs px-3.5 py-1.5 min-h-[36px] md:min-h-[34px] gap-1.5",
      lg: "text-xs px-5 py-2.5 min-h-[42px] gap-2 font-semibold",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          icon
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
