"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
}

/** Fast CSS-only entrance — use on page/hero sections only, not list items. */
export function AnimatedSection({ children, className }: AnimatedSectionProps) {
  return (
    <section className={cn("animate-content-in", className)}>
      {children}
    </section>
  );
}
