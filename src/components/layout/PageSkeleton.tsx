import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageSkeleton({ variant = "default" }: { variant?: "default" | "feed" | "detail" | "map" }) {
  if (variant === "map") {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-lg" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (variant === "feed") {
    return (
      <div className="animate-fade-in space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("animate-fade-in space-y-4")}>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-xl" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
