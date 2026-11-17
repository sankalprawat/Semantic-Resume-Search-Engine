import React, { useId } from "react";

export interface BrandLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "hero";
  className?: string;
}

const SIZE_MAP = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
  hero: "w-24 h-24",
};

/**
 * BrandLogo - Official vector logo for Multi-Candidate Semantic Talent Engine.
 * Features a textured candidate resume card overlaid with an illuminated 3D semantic neural graph.
 */
export function BrandLogo({ size, className = "", ...props }: BrandLogoProps) {
  const rawId = useId();
  // Sanitize id for SVG url(#id) compatibility
  const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  const sizeClass = size ? SIZE_MAP[size] : "w-full h-full";

  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${sizeClass} ${className}`.trim()}
      aria-label="Semantic Talent Engine Logo"
      {...props}
    >
      <defs>
        {/* Background Network Gradient */}
        <linearGradient
          id={`${id}_back_grad`}
          x1="4.4"
          y1="6.6"
          x2="192.4"
          y2="206.6"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Textured Resume Paper Gradient */}
        <linearGradient
          id={`${id}_paper_grad`}
          x1="0.5"
          y1="0.5"
          x2="108.5"
          y2="164.5"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FDFCF9" />
          <stop offset="0.55" stopColor="#F6F2E9" />
          <stop offset="1" stopColor="#EAE3D5" />
        </linearGradient>

        {/* Dog-Ear Fold Gradient */}
        <linearGradient
          id={`${id}_fold_grad`}
          x1="88"
          y1="20"
          x2="108"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#DFD7C8" />
          <stop offset="1" stopColor="#CFC5B3" />
        </linearGradient>

        {/* Foreground Neural Overlap Gradient */}
        <linearGradient
          id={`${id}_fore_grad`}
          x1="1.8"
          y1="3.76"
          x2="185.8"
          y2="203.47"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#2563EB" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>

        {/* Paper Mask to clip inner elements */}
        <clipPath id={`${id}_paper_clip`}>
          <path d="M5 0H88L108 20V159C108 161.761 105.761 164 103 164H5C2.2386 164 0 161.761 0 159V5C0 2.2386 2.2386 0 5 0Z" />
        </clipPath>
      </defs>

      {/* 1. Background Neural Constellation */}
      <g id="Neural_Network_Back" transform="translate(22.2, 14)">
        <path
          d="M96.4 4.6L14.4 50.6L4.4 108.6L18.4 166.6L100.4 206.6L176.4 168.6L192.4 110.6L180.4 46.6L96.4 4.6Z"
          strokeWidth="1.35"
          strokeLinejoin="round"
          stroke={`url(#${id}_back_grad)`}
          strokeOpacity="0.45"
        />
        <path
          d="M4.4 108.6L192.4 110.6M14.4 50.6L176.4 168.6M18.4 166.6L180.4 46.6"
          strokeWidth="1"
          strokeDasharray="3 3"
          stroke="#2563EB"
          strokeOpacity="0.25"
        />
        <g id="Back_Nodes">
          <circle cx="96.4" cy="4.6" r="3.4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="14.4" cy="50.6" r="3.4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="4.4" cy="108.6" r="3.2" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="18.4" cy="166.6" r="3.4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="100.4" cy="206.6" r="3.4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="176.4" cy="168.6" r="3.4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="192.4" cy="110.6" r="3.2" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
          <circle cx="180.4" cy="46.6" r="3.4" fill="#2563EB" stroke="#93C5FD" strokeWidth="1.2" />
        </g>
      </g>

      {/* 2. Resume Document */}
      <g id="Resume_Document" transform="translate(66, 36)">
        {/* Paper Surface with Edge Shading */}
        <path
          d="M5.5 0.5H88.5L108.5 20.5V159.5C108.5 162.261 106.261 164.5 103.5 164.5H5.5C2.7386 164.5 0.5 162.261 0.5 159.5V5.5C0.5 2.7386 2.7386 0.5 5.5 0.5Z"
          fill={`url(#${id}_paper_grad)`}
          stroke="#D6CEC0"
          strokeWidth="1"
        />

        {/* Clipped Resume Elements */}
        <g clipPath={`url(#${id}_paper_clip)`}>
          {/* Left Spine Accent */}
          <path d="M3.5 0H0V164H3.5V0Z" fill="#E5DEC9" />

          {/* Profile Card & Avatar */}
          <rect x="12" y="14" width="22" height="22" rx="4" fill="#E7E1D4" stroke="#D5CCB9" strokeWidth="0.8" />
          <circle cx="23" cy="22" r="3.5" fill="#8C8275" />
          <path d="M17 32.5C17 29.5 19.7 27.5 23 27.5C26.3 27.5 29 29.5 29 32.5" fill="#8C8275" />

          {/* Candidate Header Hierarchy */}
          <rect x="40" y="17" width="42" height="4.8" rx="2.4" fill="#1C1917" />
          <rect x="40" y="25.5" width="28.4" height="3.2" rx="1.6" fill="#78716C" />
          <rect x="40" y="32" width="20.75" height="2.5" rx="1.25" fill="#A8A29E" />

          {/* Section Divider */}
          <line x1="12" y1="44" x2="96" y2="44" stroke="#DFD8C8" strokeWidth="1" />

          {/* Experience Section */}
          <rect x="12" y="51" width="24.6" height="2.8" rx="1.4" fill="#57534E" />
          <rect x="12" y="58" width="44.1" height="3.8" rx="1.9" fill="#292524" />
          <rect x="16" y="66" width="74.7" height="2.6" rx="1.3" fill="#78716C" />

          {/* Highlighted Semantic Match Chip */}
          <rect x="13" y="72" width="78" height="8" rx="2" fill="#DBEAFE" stroke="#93C5FD" strokeWidth="0.6" />
          <rect x="16" y="74.7" width="66.7" height="2.6" rx="1.3" fill="#1E40AF" />

          <rect x="16" y="84" width="60.7" height="2.6" rx="1.3" fill="#78716C" />

          {/* Projects / Education */}
          <rect x="12" y="95" width="38.1" height="3.8" rx="1.9" fill="#292524" />
          <rect x="16" y="103" width="72.7" height="2.6" rx="1.3" fill="#78716C" />
          <rect x="16" y="110" width="54.7" height="2.6" rx="1.3" fill="#78716C" />

          {/* Skills Section Pills */}
          <rect x="12" y="121" width="18.6" height="2.8" rx="1.4" fill="#57534E" />
          <rect x="12" y="128" width="22" height="7.5" rx="2" fill="#EAE4D7" stroke="#D5CCB9" strokeWidth="0.6" />
          <rect x="40" y="128" width="28" height="7.5" rx="2" fill="#EAE4D7" stroke="#D5CCB9" strokeWidth="0.6" />
          <rect x="74" y="128" width="20" height="7.5" rx="2" fill="#EAE4D7" stroke="#D5CCB9" strokeWidth="0.6" />
          <rect x="12" y="139" width="26" height="7.5" rx="2" fill="#EAE4D7" stroke="#D5CCB9" strokeWidth="0.6" />
          <rect x="44" y="139" width="22" height="7.5" rx="2" fill="#EAE4D7" stroke="#D5CCB9" strokeWidth="0.6" />

          {/* Dog-Ear Fold Shadow & Flap */}
          <path d="M88 20H108V25L88 20Z" fill="#1C1917" fillOpacity="0.08" />
          <path d="M88 0V16C88 18.2091 89.791 20 92 20H108L88 0Z" fill={`url(#${id}_fold_grad)`} />
        </g>
      </g>

      {/* 3. Foreground Neural Mesh & Central Target */}
      <g id="Neural_Network_Overlap" transform="translate(26, 22)">
        {/* Soft Glow Underlay */}
        <path
          d="M11.8 46.9L65.8 44.9M65.8 44.9L111.8 74.3M65.8 44.9L93.8 1.8M65.8 44.9L87.8 94.9M111.8 74.3L177.8 43M111.8 74.3L87.8 94.9M87.8 94.9L1.8 103.7M87.8 94.9L121.8 125.3M87.8 94.9L73.8 148.8M121.8 125.3L189.8 105.7M121.8 125.3L97.8 199.8L73.8 148.8M121.8 125.3L173.8 162.6M15.8 160.6L73.8 148.8"
          stroke="#38BDF8"
          strokeOpacity="0.25"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Sharp Gradient Neural Links */}
        <path
          d="M11.8 46.9L65.8 44.9M65.8 44.9L111.8 74.3M65.8 44.9L93.8 1.8M65.8 44.9L87.8 94.9M111.8 74.3L177.8 43M111.8 74.3L87.8 94.9M87.8 94.9L1.8 103.7M87.8 94.9L121.8 125.3M87.8 94.9L73.8 148.8M121.8 125.3L189.8 105.7M121.8 125.3L97.8 199.8L73.8 148.8M121.8 125.3L173.8 162.6M15.8 160.6L73.8 148.8"
          stroke={`url(#${id}_fore_grad)`}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Target Node 1 */}
        <g transform="translate(65.8, 44.9)">
          <circle r="6.4" fill="#2563EB" fillOpacity="0.16" />
          <circle r="4" fill="#2563EB" stroke="#FDFCF9" strokeWidth="1.4" />
          <circle r="1.3" fill="#BAE6FD" />
        </g>

        {/* Target Node 2 */}
        <g transform="translate(111.8, 74.3)">
          <circle r="6.4" fill="#2563EB" fillOpacity="0.16" />
          <circle r="4" fill="#2563EB" stroke="#FDFCF9" strokeWidth="1.4" />
          <circle r="1.3" fill="#BAE6FD" />
        </g>

        {/* Target Node 3: CENTRAL ANCHOR (Semantic Core) */}
        <g transform="translate(87.8, 94.9)">
          <circle r="8.5" fill="#0284C7" fillOpacity="0.25" />
          <circle r="5" fill="#1D4ED8" stroke="#FDFCF9" strokeWidth="1.6" />
          <circle r="2" fill="#E0F2FE" />
        </g>

        {/* Target Node 4 */}
        <g transform="translate(121.8, 125.3)">
          <circle r="6.4" fill="#2563EB" fillOpacity="0.16" />
          <circle r="4" fill="#2563EB" stroke="#FDFCF9" strokeWidth="1.4" />
          <circle r="1.3" fill="#BAE6FD" />
        </g>

        {/* Target Node 5 */}
        <g transform="translate(73.8, 148.8)">
          <circle r="6.4" fill="#2563EB" fillOpacity="0.16" />
          <circle r="4" fill="#2563EB" stroke="#FDFCF9" strokeWidth="1.4" />
          <circle r="1.3" fill="#BAE6FD" />
        </g>
      </g>
    </svg>
  );
}
export default BrandLogo;
