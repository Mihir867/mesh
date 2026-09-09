import React from "react";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Width of the skeleton element
   * Can be a number (pixels), string (any CSS value), or undefined (100%)
   */
  width?: number | string;
  
  /**
   * Height of the skeleton element
   * Can be a number (pixels), string (any CSS value), or undefined
   */
  height?: number | string;
  
  /**
   * Border radius variant
   * @default "md"
   */
  radius?: "none" | "sm" | "md" | "lg" | "pill" | "full";
  
  /**
   * Whether to show the shimmer animation
   * @default true
   */
  animate?: boolean;
  
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Skeleton - Premium loading placeholder component
 * 
 * A minimal, Linear-inspired skeleton loader that matches the design system.
 * Uses subtle shimmer animation and flat surface color.
 * 
 * @example
 * // Basic usage
 * <Skeleton width={200} height={20} />
 * 
 * @example
 * // Text line
 * <Skeleton width="75%" height={16} radius="sm" />
 * 
 * @example
 * // Avatar
 * <Skeleton width={40} height={40} radius="full" />
 * 
 * @example
 * // Button
 * <Skeleton width={120} height={32} radius="md" />
 */
export function Skeleton({
  width,
  height,
  radius = "md",
  animate = true,
  className = "",
  style,
  ...props
}: SkeletonProps) {
  const radiusMap = {
    none: "0",
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    pill: "var(--radius-pill)",
    full: "50%",
  };

  const computedStyle: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width || "100%",
    height: typeof height === "number" ? `${height}px` : height || "auto",
    borderRadius: radiusMap[radius],
    background: "var(--color-surface)",
    ...(animate && {
      backgroundImage: `linear-gradient(
        90deg,
        var(--color-surface) 0%,
        var(--color-border-subtle) 50%,
        var(--color-surface) 100%
      )`,
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.5s ease-in-out infinite",
    }),
    ...style,
  };

  return <div className={className} style={computedStyle} {...props} />;
}

/**
 * SkeletonText - Preset for text lines
 * 
 * @example
 * <SkeletonText lines={3} />
 */
export interface SkeletonTextProps {
  /**
   * Number of text lines to render
   * @default 1
   */
  lines?: number;
  
  /**
   * Width of each line (last line is typically shorter)
   */
  widths?: (number | string)[];
  
  /**
   * Height of each line
   * @default 16
   */
  lineHeight?: number;
  
  /**
   * Gap between lines
   * @default 8
   */
  gap?: number;
}

export function SkeletonText({
  lines = 1,
  widths,
  lineHeight = 16,
  gap = 8,
}: SkeletonTextProps) {
  const defaultWidths = ["100%", "100%", "75%", "90%", "60%"];
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${gap}px` }}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={widths?.[i] || defaultWidths[i % defaultWidths.length]}
          height={lineHeight}
          radius="sm"
        />
      ))}
    </div>
  );
}

/**
 * SkeletonAvatar - Preset for avatar/profile images
 */
export interface SkeletonAvatarProps {
  size?: number;
}

export function SkeletonAvatar({ size = 40 }: SkeletonAvatarProps) {
  return <Skeleton width={size} height={size} radius="full" />;
}

/**
 * SkeletonButton - Preset for button shapes
 */
export interface SkeletonButtonProps {
  width?: number | string;
  height?: number;
  variant?: "primary" | "secondary";
}

export function SkeletonButton({
  width = 120,
  height = 32,
  variant = "primary",
}: SkeletonButtonProps) {
  return <Skeleton width={width} height={height} radius="md" />;
}

/**
 * SkeletonCard - Preset for card layouts
 */
export interface SkeletonCardProps {
  /**
   * Show avatar in card
   * @default false
   */
  withAvatar?: boolean;
  
  /**
   * Number of text lines in card body
   * @default 3
   */
  lines?: number;
  
  /**
   * Show action button at bottom
   * @default false
   */
  withAction?: boolean;
}

export function SkeletonCard({
  withAvatar = false,
  lines = 3,
  withAction = false,
}: SkeletonCardProps) {
  return (
    <div
      style={{
        padding: "16px",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-bg)",
      }}
    >
      {/* Header with optional avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
        {withAvatar && <SkeletonAvatar size={40} />}
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height={16} radius="sm" />
          <div style={{ height: "6px" }} />
          <Skeleton width="40%" height={12} radius="sm" />
        </div>
      </div>

      {/* Body text */}
      <SkeletonText lines={lines} lineHeight={14} gap={8} />

      {/* Optional action */}
      {withAction && (
        <>
          <div style={{ height: "16px" }} />
          <SkeletonButton width={100} height={28} />
        </>
      )}
    </div>
  );
}

/**
 * SkeletonTable - Preset for table layouts
 */
export interface SkeletonTableProps {
  /**
   * Number of columns
   * @default 4
   */
  columns?: number;
  
  /**
   * Number of rows
   * @default 5
   */
  rows?: number;
  
  /**
   * Show table header
   * @default true
   */
  showHeader?: boolean;
}

export function SkeletonTable({
  columns = 4,
  rows = 5,
  showHeader = true,
}: SkeletonTableProps) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        background: "var(--color-surface)",
      }}
    >
      {/* Header */}
      {showHeader && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: "12px",
            padding: "12px",
            borderBottom: "1px solid var(--color-border)",
            background: "var(--color-surface)",
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} height={14} radius="sm" />
          ))}
        </div>
      )}

      {/* Rows */}
      <div style={{ padding: "12px" }}>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: "12px",
              paddingTop: rowIdx > 0 ? "12px" : "0",
              paddingBottom: "12px",
              borderBottom:
                rowIdx < rows - 1 ? "1px solid var(--color-border-subtle)" : "none",
            }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <Skeleton key={colIdx} height={12} radius="sm" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default Skeleton;
