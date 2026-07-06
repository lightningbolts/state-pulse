"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  groupByState,
  rerankCandidates,
  type CompareCandidate,
  type StateComparisonRow,
} from "@/lib/comparisonScoring";
import { getStoredUserState, setStoredUserState } from "@/lib/userStateStorage";
import { STATE_NAMES } from "@/types/geo";
import { useSemanticSearch } from "@/hooks/useSemanticSearch";
import { useComparisonSynthesis } from "@/hooks/useComparisonSynthesis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Sparkles, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

const STATE_OPTIONS = Object.entries(STATE_NAMES)
  .filter(([abbr]) => abbr !== "US")
  .sort(([, a], [, b]) => a.localeCompare(b));

interface CompareApiResponse {
  query: string;
  detectedTopics: { broad: string[]; narrow: string[] };
  candidates: CompareCandidate[];
}

export function StateLegislationComparison() {
  const [query, setQuery] = useState("");
  const [userState, setUserState] = useState("");
  const [enactedOnly, setEnactedOnly] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [stateResults, setStateResults] = useState<StateComparisonRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { embedQuery, modelState } = useSemanticSearch();
  const { synthesis, synthState, generateComparison, resetSynthesis } = useComparisonSynthesis();

  useEffect(() => {
    const stored = getStoredUserState();
    if (stored) setUserState(stored);
  }, []);

  const handleStateChange = (value: string) => {
    setUserState(value);
    setStoredUserState(value);
  };

  const toggleRow = (jurisdiction: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(jurisdiction)) next.delete(jurisdiction);
      else next.add(jurisdiction);
      return next;
    });
  };

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setError(null);
    resetSynthesis();
    setStateResults([]);

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (enactedOnly) params.set("enactedOnly", "true");

      const res = await fetch(`/api/legislation/compare?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Search failed");
      }

      const data: CompareApiResponse = await res.json();
      const topics = [...data.detectedTopics.broad, ...data.detectedTopics.narrow];
      setDetectedTopics(topics);

      const queryVec = await embedQuery(trimmed);
      const ranked = rerankCandidates(trimmed, queryVec, data.candidates, topics);
      const grouped = groupByState(ranked, userState || undefined);
      setStateResults(grouped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSearching(false);
    }
  }, [query, enactedOnly, userState, embedQuery, resetSynthesis]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Compare State Legislation</CardTitle>
          <CardDescription>
            Search a policy issue and see how each state&apos;s most relevant bill compares. Semantic
            search runs in your browser — no API keys required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='e.g. "minimum wage", "gun control", "paid family leave"'
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching || !query.trim()}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching…
                </>
              ) : (
                "Compare States"
              )}
            </Button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="user-state">Your state (optional)</Label>
              <Select value={userState} onValueChange={handleStateChange}>
                <SelectTrigger id="user-state">
                  <SelectValue placeholder="Select your state" />
                </SelectTrigger>
                <SelectContent>
                  {STATE_OPTIONS.map(([abbr, name]) => (
                    <SelectItem key={abbr} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="enacted-only"
                checked={enactedOnly}
                onCheckedChange={(v) => setEnactedOnly(v === true)}
              />
              <Label htmlFor="enacted-only" className="cursor-pointer">
                Enacted bills only
              </Label>
            </div>
          </div>

          {modelState === "loading" && (
            <p className="text-sm text-muted-foreground">
              Loading semantic search model (one-time ~23 MB download)…
            </p>
          )}
          {modelState === "error" && (
            <p className="text-sm text-amber-600">
              Semantic model unavailable — using keyword matching instead.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {detectedTopics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {detectedTopics.map((topic) => (
            <Badge key={topic} variant="secondary">
              {topic}
            </Badge>
          ))}
        </div>
      )}

      {stateResults.length > 0 && (
        <AnimatedSection>
          <Card className="shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">
                  Results across {stateResults.length} jurisdictions
                </CardTitle>
                <CardDescription>Top matching bill per state, ranked by relevance</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={synthState === "loading"}
                onClick={() => generateComparison(query, stateResults, userState)}
              >
                {synthState === "loading" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Comparison
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(synthesis || synthState === "loading") && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Browser-generated comparison
                  </p>
                  {synthState === "loading" ? (
                    <p className="text-sm text-muted-foreground">
                      Generating comparison in your browser (~30 MB model, one-time download)…
                    </p>
                  ) : (
                    <p className="text-sm leading-relaxed">{synthesis}</p>
                  )}
                  {synthesis && (
                    <p className="text-xs text-muted-foreground">
                      Generated in your browser from the bills above. Not human-curated — verify
                      against the quoted text.
                    </p>
                  )}
                </div>
              )}

              {stateResults.map((row) => {
                const bill = row.topBill;
                const expanded = expandedRows.has(row.jurisdictionName);
                return (
                  <div
                    key={row.jurisdictionName}
                    className={`rounded-lg border p-4 ${
                      row.isUserState ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{row.jurisdictionName}</h3>
                          {row.isUserState && <Badge>Your state</Badge>}
                          {bill?.enactedAt && <Badge variant="outline">Enacted</Badge>}
                        </div>
                        {bill ? (
                          <Link
                            href={`/legislation/${bill.id}`}
                            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                          >
                            {bill.identifier}: {bill.title}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <p className="text-sm text-muted-foreground">No matching bill found</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {(row.score * 100).toFixed(0)}% match
                        </Badge>
                        {bill && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRow(row.jurisdictionName)}
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {bill?.geminiSummary && !expanded && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {bill.geminiSummary}
                      </p>
                    )}

                    {expanded && bill && (
                      <div className="mt-3 space-y-2 text-sm text-muted-foreground border-t pt-3">
                        {bill.geminiSummary && <p>{bill.geminiSummary}</p>}
                        {bill.longGeminiSummary && bill.longGeminiSummary !== bill.geminiSummary && (
                          <p className="italic">{bill.longGeminiSummary}</p>
                        )}
                        {bill.statusText && (
                          <p>
                            <span className="font-medium text-foreground">Status:</span>{" "}
                            {bill.statusText}
                          </p>
                        )}
                        {bill.chamber && (
                          <p>
                            <span className="font-medium text-foreground">Chamber:</span>{" "}
                            {bill.chamber}
                          </p>
                        )}
                        {bill.subjects && bill.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {bill.subjects.slice(0, 5).map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </AnimatedSection>
      )}
    </div>
  );
}
