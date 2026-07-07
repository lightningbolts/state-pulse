"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { StateComparisonRow, RankingMethod } from "@/lib/comparisonScoring";
import type { EmbeddingCoverage } from "@/services/stateLegislationComparisonService";
import { buildStructuredComparison } from "@/lib/comparisonStructured";
import { EXAMPLE_QUERIES } from "@/lib/comparisonConstants";
import { getStoredUserState, setStoredUserState } from "@/lib/userStateStorage";
import { STATE_NAMES } from "@/types/geo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { StructuredComparisonView } from "@/components/features/StructuredComparison";

const STATE_OPTIONS = Object.entries(STATE_NAMES)
  .filter(([abbr]) => abbr !== "US")
  .sort(([, a], [, b]) => a.localeCompare(b));

type SearchStage = "idle" | "finding" | "ranking" | "done";

interface CompareApiResponse {
  query: string;
  detectedTopics: { broad: string[]; narrow: string[] };
  stateResults: StateComparisonRow[];
  lowConfidenceResults: StateComparisonRow[];
  rankingMethod: RankingMethod;
  coverage: EmbeddingCoverage;
}

export function StateLegislationComparison() {
  const [query, setQuery] = useState("");
  const [userState, setUserState] = useState("");
  const [enactedOnly, setEnactedOnly] = useState(false);
  const [searchStage, setSearchStage] = useState<SearchStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [detectedTopics, setDetectedTopics] = useState<string[]>([]);
  const [stateResults, setStateResults] = useState<StateComparisonRow[]>([]);
  const [lowConfidenceResults, setLowConfidenceResults] = useState<StateComparisonRow[]>([]);
  const [showLowConfidence, setShowLowConfidence] = useState(false);
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>("keyword");
  const [coverage, setCoverage] = useState<EmbeddingCoverage | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [synthLoading, setSynthLoading] = useState(false);

  const isSearching = searchStage === "finding" || searchStage === "ranking";

  useEffect(() => {
    const stored = getStoredUserState();
    if (stored) setUserState(stored);

    fetch("/api/legislation/compare/coverage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCoverage(data))
      .catch(() => {});
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

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const trimmed = (searchQuery ?? query).trim();
    if (!trimmed) return;

    if (searchQuery) setQuery(searchQuery);

    setSearchStage("finding");
    setError(null);
    setSynthesis(null);
    setStateResults([]);
    setLowConfidenceResults([]);
    setShowLowConfidence(false);

    try {
      const params = new URLSearchParams({ q: trimmed });
      if (enactedOnly) params.set("enactedOnly", "true");
      if (userState) params.set("userState", userState);

      setSearchStage("ranking");

      const res = await fetch(`/api/legislation/compare?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Search failed");
      }

      const data: CompareApiResponse = await res.json();
      const topics = [...data.detectedTopics.broad, ...data.detectedTopics.narrow];
      setDetectedTopics(topics);
      setStateResults(data.stateResults);
      setLowConfidenceResults(data.lowConfidenceResults);
      setRankingMethod(data.rankingMethod);
      setCoverage(data.coverage);
      setSearchStage("done");
    } catch (err) {
      setError((err as Error).message);
      setSearchStage("idle");
    }
  }, [query, enactedOnly, userState]);

  const handleExampleClick = (example: string) => {
    void handleSearch(example);
  };

  const handleGenerateAiSummary = useCallback(async () => {
    const bills = stateResults
      .filter((row) => row.topBill)
      .map((row) => ({
        jurisdictionName: row.jurisdictionName,
        identifier: row.topBill?.identifier || "",
        title: row.topBill?.title || "",
        geminiSummary: row.topBill?.geminiSummary,
        enactedAt: row.topBill?.enactedAt,
        statusText: row.topBill?.statusText,
      }));

    if (bills.length < 2) return;

    setSynthLoading(true);
    setSynthesis(null);

    try {
      const res = await fetch("/api/legislation/compare/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, userState: userState || undefined, bills }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to generate summary");

      setSynthesis(body.synthesis);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSynthLoading(false);
    }
  }, [stateResults, query, userState]);

  const structuredGroups = useMemo(
    () => buildStructuredComparison(stateResults, userState || undefined),
    [stateResults, userState],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const searchStageLabel =
    searchStage === "finding"
      ? "Finding matching bills…"
      : searchStage === "ranking"
        ? "Ranking by relevance across states…"
        : null;

  const renderResultRow = (row: StateComparisonRow) => {
    const bill = row.topBill;
    const expanded = expandedRows.has(row.jurisdictionName);

    return (
      <div
        key={row.jurisdictionName}
        className={`rounded-lg border p-4 ${
          row.isUserState ? "border-primary bg-primary/5" : ""
        } ${row.lowConfidence ? "opacity-80" : ""}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{row.jurisdictionName}</h3>
              {row.isUserState && <Badge>Your state</Badge>}
              {bill?.enactedAt && <Badge variant="outline">Enacted</Badge>}
              {row.lowConfidence && (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Low confidence
                </Badge>
              )}
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
            <Badge variant="secondary">{(row.score * 100).toFixed(0)}% match</Badge>
            {bill && (
              <Button variant="ghost" size="sm" onClick={() => toggleRow(row.jurisdictionName)}>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>

        {row.matchReasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {row.matchReasons.map((reason) => (
              <Badge key={reason} variant="outline" className="text-xs font-normal">
                {reason}
              </Badge>
            ))}
          </div>
        )}

        {bill?.geminiSummary && !expanded && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{bill.geminiSummary}</p>
        )}

        {expanded && bill && (
          <div className="mt-3 space-y-2 text-sm text-muted-foreground border-t pt-3">
            {bill.geminiSummary && <p>{bill.geminiSummary}</p>}
            {bill.longGeminiSummary && bill.longGeminiSummary !== bill.geminiSummary && (
              <p className="italic">{bill.longGeminiSummary}</p>
            )}
            {bill.statusText && (
              <p>
                <span className="font-medium text-foreground">Status:</span> {bill.statusText}
              </p>
            )}
            {bill.chamber && (
              <p>
                <span className="font-medium text-foreground">Chamber:</span> {bill.chamber}
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
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex flex-wrap items-center gap-2">
            Compare State Legislation
            <Badge variant="secondary">Beta</Badge>
          </CardTitle>
          <CardDescription>
            Search a policy issue and see how each state&apos;s most relevant bill compares.
            Ranking runs on the server using semantic search when embeddings are available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {coverage && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Semantic search coverage</span>
                <span className="font-medium">{coverage.percent}% indexed</span>
              </div>
              <Progress value={coverage.percent} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {coverage.embedded.toLocaleString()} of {coverage.total.toLocaleString()} bills
                with summaries have embeddings. Coverage improves as indexing continues.
              </p>
            </div>
          )}

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

          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <Button
                key={example}
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handleExampleClick(example)}
                disabled={isSearching}
              >
                {example}
              </Button>
            ))}
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

          {searchStageLabel && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              {searchStageLabel}
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
                <CardDescription>
                  Top matching bill per state, ranked by{" "}
                  {rankingMethod === "vector" ? "semantic similarity" : "keyword relevance"}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={synthLoading || stateResults.length < 2}
                onClick={handleGenerateAiSummary}
              >
                {synthLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI Summary
                    <Badge variant="secondary" className="ml-2 font-normal">
                      Beta
                    </Badge>
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <StructuredComparisonView groups={structuredGroups} />

              {synthesis && (
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      AI-generated comparison
                    </p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Beta
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed">{synthesis}</p>
                  <p className="text-xs text-muted-foreground">
                    Generated from the bill summaries above. Not human-curated — verify against
                    each bill.
                  </p>
                </div>
              )}

              {stateResults.map(renderResultRow)}

              {lowConfidenceResults.length > 0 && (
                <div className="pt-2 border-t space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLowConfidence((v) => !v)}
                    className="text-muted-foreground"
                  >
                    {showLowConfidence ? "Hide" : "Show"} {lowConfidenceResults.length} low-confidence
                    match{lowConfidenceResults.length === 1 ? "" : "es"}
                    {showLowConfidence ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </Button>
                  {showLowConfidence && lowConfidenceResults.map(renderResultRow)}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {searchStage === "done" &&
        stateResults.length === 0 &&
        lowConfidenceResults.length > 0 && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                No high-confidence matches found. Showing lower-confidence results — try a more
                specific query or check back as more bills are indexed.
              </p>
              {lowConfidenceResults.map(renderResultRow)}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
