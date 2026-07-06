import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-background", className)}>
      {children}
    </div>
  );
}
