import { Badge } from '@/components/ui/badge';
import type { StructuredComparisonGroup } from '@/lib/comparisonStructured';

export function StructuredComparisonView({ groups }: { groups: StructuredComparisonGroup[] }) {
  if (groups.length === 0) return null;

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Side-by-side comparison
        </p>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          Beta
        </Badge>
      </div>

      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{group.label}</h4>
          <div className="space-y-3">
            {group.entries.map((entry) => (
              <div
                key={entry.jurisdictionName}
                className={`rounded-md border bg-background p-3 ${
                  entry.isUserState ? 'border-primary/50' : ''
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{entry.jurisdictionName}</span>
                  {entry.isUserState && <Badge className="text-xs">Your state</Badge>}
                  <Badge variant="outline" className="text-xs">
                    {entry.statusLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                  {entry.identifier}
                  {entry.title ? `: ${entry.title}` : ''}
                </p>
                <p className="text-sm leading-relaxed">{entry.excerpt}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Built from bill summaries above. Verify details on each bill&apos;s page.
      </p>
    </div>
  );
}
