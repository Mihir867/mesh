"use client"

import Link from "next/link";
import { useState } from "react";

export function CTAButtons() {
  return (
    <div className="flex items-center gap-3 pt-4">
      <Link href="/dashboard">
        <InteractiveButton variant="primary">
          Start Free Trial
        </InteractiveButton>
      </Link>
      <Link href="/dashboard">
        <InteractiveButton variant="secondary">
          Sign In
        </InteractiveButton>
      </Link>
    </div>
  );
}

export function HeaderCTAButtons() {
  return (
    <div className="flex items-center gap-3">
      <Link href="/dashboard">
        <InteractiveButton variant="ghost" size="sm">
          Sign In
        </InteractiveButton>
      </Link>
      <Link href="/dashboard">
        <InteractiveButton variant="primary" size="sm">
          Get Started
        </InteractiveButton>
      </Link>
    </div>
  );
}

interface InteractiveButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "default" | "sm";
}

function InteractiveButton({ 
  children, 
  variant = "primary",
  size = "default" 
}: InteractiveButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getStyles = () => {
    const baseStyles = {
      height: size === "sm" ? "28px" : "36px",
      padding: size === "sm" ? "0 14px" : "0 16px",
      fontSize: "15px",
      fontWeight: "var(--font-weight-medium)" as const,
      border: "none",
      borderRadius: "var(--radius-md)",
      cursor: "pointer",
      transition: "all 120ms ease-out",
      letterSpacing: "-0.006em",
    };

    if (variant === "primary") {
      return {
        ...baseStyles,
        color: "white",
        background: isHovered ? "var(--color-accent-hover)" : "var(--color-accent)",
      };
    }

    if (variant === "secondary") {
      return {
        ...baseStyles,
        color: "var(--color-text-primary)",
        background: isHovered ? "var(--color-surface)" : "transparent",
        border: "1px solid var(--color-border)",
      };
    }

    // ghost variant
    return {
      ...baseStyles,
      color: isHovered ? "var(--color-text-primary)" : "var(--color-text-secondary)",
      background: "transparent",
    };
  };

  return (
    <button
      style={getStyles()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  );
}

export function FooterLink({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={{
        fontSize: "13px",
        fontWeight: "var(--font-weight-regular)" as const,
        color: isHovered ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        transition: "color 120ms ease-out",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </button>
  );
}
