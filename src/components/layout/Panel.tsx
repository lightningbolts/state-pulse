import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("animate-panel-in", className)}>
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-medium text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      <div className="gap-px bg-border p-px">{children}</div>
    </section>
  );
}

export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-surface p-4", className)}>{children}</div>
  );
}
