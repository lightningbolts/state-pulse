import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function LegislationDetailLoading() {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Card className="w-full max-w-4xl mx-auto shadow-xl rounded-lg overflow-hidden">
        <CardHeader className="bg-gray-700 text-primary-foreground p-6 space-y-3">
          <Skeleton className="h-8 w-3/4 bg-primary-foreground/20" />
          <Skeleton className="h-4 w-1/2 bg-primary-foreground/20" />
        </CardHeader>
        <CardContent className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-14" />
              </div>
            </div>
          </div>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
