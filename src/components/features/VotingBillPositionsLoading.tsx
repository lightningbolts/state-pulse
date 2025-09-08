import { Skeleton } from "@/components/ui/skeleton";

export function VotingBillPositionsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <Skeleton className="h-7 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="p-3 border rounded-lg">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-3 w-full mb-1" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="h-64 border rounded-lg bg-muted/20 flex items-center justify-center">
        <div className="text-center space-y-2">
          <Skeleton className="h-32 w-32 rounded-full mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
        </div>
      </div>
    </div>
  );
}
