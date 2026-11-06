"use client";

import type { CSSProperties } from "react";

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
  rounded?: boolean;
}

/** Generic shimmering skeleton block. */
export default function Skeleton({ width, height, className = "", style, rounded = true }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton ${className}`}
      style={{
        width: width ?? "100%",
        height: height ?? "16px",
        borderRadius: rounded ? "var(--radius-sm)" : 0,
        ...style,
      }}
    />
  );
}
