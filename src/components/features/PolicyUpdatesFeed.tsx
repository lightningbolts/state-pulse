"use client";
            import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
            import { Badge } from "@/components/ui/badge";
            import { Input } from "@/components/ui/input";
            import { Button } from "@/components/ui/button";
            import { Bookmark, Search } from "lucide-react";
            import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
            import {
              DropdownMenu,
              DropdownMenuTrigger,
              DropdownMenuContent,
              DropdownMenuRadioGroup,
              DropdownMenuRadioItem,
            } from "@/components/ui/dropdown-menu";
            import Link from "next/link";

            interface PolicyUpdate {
              id: string;
              title?: string;
              jurisdictionName?: string;
              session?: string;
              subjects?: string[];
              createdAt?: string;
              summary?: string;
              geminiSummary?: string; // Add geminiSummary field
              classification?: string[];
              openstatesUrl?: string;
              latestActionDescription?: string;
              sources?: { url: string; note?: string | null }[];
              sponsors?: { name: string }[];
              lastActionAt?: string | null;
              identifier?: string;
            }

            // Classification tags (no descriptions)
            const CLASSIFICATIONS = [
              { label: "All", value: "" },
              { label: "Bill", value: "bill" },
              { label: "Resolution", value: "resolution" },
              { label: "Joint Resolution", value: "joint resolution" },
              { label: "Concurrent Resolution", value: "concurrent resolution" },
              { label: "Memorial", value: "memorial" },
              { label: "Proclamation", value: "proclamation" },
            ];

            let cardNumber = 20;

            // Fetch updates with optional filters and sorting
            async function fetchUpdatesFeed({ skip = 0, limit = cardNumber, search = "", subject = "", sortField = "createdAt", sortDir = "desc", classification = "" }: { skip?: number; limit?: number; search?: string; subject?: string; sortField?: string; sortDir?: string; classification?: string }) {
              const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
              if (search) params.append("search", search);
              if (subject) params.append("subject", subject);
              if (sortField) params.append("sortBy", sortField);
              if (sortDir) params.append("sortDir", sortDir);
              if (classification) params.append("classification", classification);
              const res = await fetch(`/api/legislation?${params.toString()}`);
              if (!res.ok) throw new Error("Failed to fetch updates");
              const data = await res.json();
              return data;
            }

            export function PolicyUpdatesFeed() {
              const [updates, setUpdates] = useState<PolicyUpdate[]>([]);
              const [loading, setLoading] = useState(false);
              const [hasMore, setHasMore] = useState(true);
              const [skip, setSkip] = useState(0);
              const [search, setSearch] = useState("");
              const [subject, setSubject] = useState("");
              const [classification, setClassification] = useState("");
              const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'createdAt', dir: 'desc' });
              const [showLoadingText, setShowLoadingText] = useState(true);
              const [isFetchingMore, setIsFetchingMore] = useState(false);
              const [searchInput, setSearchInput] = useState("");
              const loader = useRef<HTMLDivElement | null>(null);

              const loadMore = useCallback(async () => {
                if (loading || !hasMore) return;
                setLoading(true);
                try {
                  const newUpdates = await fetchUpdatesFeed({ skip, limit: 20, search, subject, sortField: sort.field, sortDir: sort.dir, classification });
                  setUpdates((prev) => [...prev, ...newUpdates]);
                  setSkip((prev) => prev + newUpdates.length);
                  setHasMore(newUpdates.length === 20);
                } catch {
                  setHasMore(false);
                } finally {
                  setLoading(false);
                }
              }, [skip, loading, hasMore, search, subject, sort, classification]);

              // Search handler for button/enter
              const handleSearch = useCallback(() => {
                if (search === searchInput) return;
                setSearch(searchInput);
                setUpdates([]);
                setSkip(0);
                setHasMore(true);
              }, [searchInput, search, setUpdates]);

              // --- Seamless state/scroll restore ---
              // Use a ref to block the initial fetch until state/scroll is restored
              const didRestore = useRef(false);

              useLayoutEffect(() => {
                if (didRestore.current) return;
                const saved = localStorage.getItem('policyUpdatesFeedState');
                if (saved) {
                  const state = JSON.parse(saved);
                  setSearch(state.search || "");
                  setSubject(state.subject || "");
                  setClassification(state.classification || "");
                  setSort(state.sort || { field: 'createdAt', dir: 'desc' });
                  setSkip(state.skip || 0);
                  setSearchInput(state.searchInput || "");
                  setUpdates(state.updates || []);
                  setHasMore(state.hasMore !== undefined ? state.hasMore : true);
                }
                // Restore scroll position *before* paint for seamlessness
                const scrollY = localStorage.getItem('policyUpdatesFeedScrollY');
                if (scrollY) {
                  window.scrollTo(0, parseInt(scrollY, 10));
                }
                didRestore.current = true;
              }, []);

              // Block the initial fetch until after restore
              useEffect(() => {
                if (!didRestore.current) return;
                let isMounted = true;
                const fetchAndSet = async () => {
                  setLoading(true);
                  try {
                    const newUpdates = await fetchUpdatesFeed({
                      skip: 0,
                      limit: 20,
                      search,
                      subject,
                      sortField: sort.field,
                      sortDir: sort.dir,
                      classification
                    });
                    if (!isMounted) return;
                    setUpdates(newUpdates);
                    setSkip(newUpdates.length);
                    setHasMore(newUpdates.length === 20);
                  } catch {
                    if (!isMounted) return;
                    setHasMore(false);
                  } finally {
                    if (!isMounted) return;
                    setLoading(false);
                  }
                };
                fetchAndSet();
                return () => { isMounted = false; };
              }, [search, subject, classification, sort, didRestore.current]);

              useEffect(() => {
                if (!loader.current) return;
                const observer = new IntersectionObserver((entries) => {
                  if (entries[0].isIntersecting && hasMore && !loading && !isFetchingMore) {
                    setIsFetchingMore(true);
                    loadMore().finally(() => setIsFetchingMore(false));
                  }
                });
                observer.observe(loader.current);
                return () => observer.disconnect();
              }, [loadMore, hasMore, loading, isFetchingMore]);

              useEffect(() => {
                let timer: NodeJS.Timeout | null = null;
                if (loading || isFetchingMore) {
                  setShowLoadingText(true);
                  timer = setInterval(() => {
                    setShowLoadingText(prev => !prev);
                  }, 1000);
                } else {
                  setShowLoadingText(false);
                }
                return () => {
                  if (timer) clearInterval(timer);
                };
              }, [loading, isFetchingMore]);


              // Save state to localStorage on change
              useEffect(() => {
                localStorage.setItem('policyUpdatesFeedState', JSON.stringify({
                  search, subject, classification, sort, skip, searchInput, updates, hasMore
                }));
              }, [search, subject, classification, sort, skip, searchInput, updates, hasMore]);

              // Save scroll position
              useEffect(() => {
                const handleScroll = () => {
                  localStorage.setItem('policyUpdatesFeedScrollY', String(window.scrollY));
                };
                window.addEventListener('scroll', handleScroll);
                return () => window.removeEventListener('scroll', handleScroll);
              }, []);

              return (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="font-headline text-2xl">Policy Updates</CardTitle>
                    <CardDescription>Stay updated with the latest policy developments. Filter by category or search for specific topics.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
                      <div className="relative flex-grow w-full sm:w-auto flex">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          placeholder="Search updates..."
                          className="pl-10 w-full"
                          value={searchInput}
                          onChange={e => setSearchInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSearch();
                          }}
                        />
                        <Button
                          className="ml-2"
                          variant="default"
                          onClick={handleSearch}
                          aria-label="Search"
                        >
                          Search
                        </Button>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto">
                            Sort: {sort.field === "createdAt" ? "Most Recent" : sort.field === "title" ? "Alphabetical" : "Custom"}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuRadioGroup
                            value={`${sort.field}:${sort.dir}`}
                            onValueChange={val => {
                              const [field, dir] = val.split(":");
                              setSort({ field, dir: dir as 'asc' | 'desc' });
                              setUpdates([]); setSkip(0); setHasMore(true);
                            }}
                          >
                            <DropdownMenuRadioItem value="createdAt:desc">Most Recent</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="createdAt:asc">Oldest</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="title:asc">Alphabetical (A-Z)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="title:desc">Alphabetical (Z-A)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="lastAction:desc">Last Action (Latest)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="lastAction:asc">Last Action (Earliest)</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button variant="outline" className="w-full sm:w-auto">
                        <Bookmark className="mr-2 h-4 w-4" />
                        Bookmarked (0)
                      </Button>
                    </div>
                    <div className="mb-4 flex flex-wrap gap-2">
                      {CLASSIFICATIONS.map(opt => (
                        <Badge
                          key={opt.value}
                          variant={classification === opt.value ? "default" : "secondary"}
                          onClick={() => setClassification(opt.value)}
                          className="cursor-pointer"
                        >
                          {opt.label}
                        </Badge>
                      ))}
                    </div>
                    <div className="mb-6 space-x-2">
                      {["Education", "Healthcare", "Policing", "Climate", "Labor", "Tech"].map((cat) => (
                        <Badge
                          key={cat}
                          variant={subject === cat ? "default" : "secondary"}
                          onClick={() => setSubject(subject === cat ? "" : cat)}
                          className="cursor-pointer"
                        >
                          #{cat}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
                      {updates.map((update, idx) => {
                        const date = update.createdAt ? new Date(update.createdAt) : null;
                        const formattedDate = date
                          ? (typeof window !== 'undefined'
                              ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : date.toISOString().slice(0, 10))
                          : '';
                        const stateUrl = update.sources && update.sources.length > 0 ? update.sources[0].url : update.openstatesUrl;
                        const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
                        const uniqueKey = update.id && updates.filter(u => u.id === update.id).length === 1 ? update.id : `${update.id || 'no-id'}-${idx}`;
                        const lastActionDate = update.lastActionAt ? new Date(update.lastActionAt) : null;
                        const formattedLastActionDate = lastActionDate
                          ? (typeof window !== 'undefined'
                              ? lastActionDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                              : lastActionDate.toISOString().slice(0, 10))
                          : null;
                        return (
                            <Link
                              key={uniqueKey}
                              href={`/legislation/${update.id}`}
                              className="block mb-4 p-4 border rounded-lg bg-background transition hover:bg-accent/50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary h-full"
                              style={{ textDecoration: 'none', color: 'inherit' }}
                              tabIndex={0}
                            >
                              <div className="flex flex-col h-full">
                                <div>
                                  <div className="font-bold text-lg mb-1 text-left">{update.identifier ? `${update.identifier} - ${update.title}` : update.title}</div>
                                  <div className="text-sm text-muted-foreground mb-1 text-left">
                                    {update.jurisdictionName} • {update.session} {formattedDate && <>• {formattedDate}</>}
                                  </div>
                                  {update.classification && update.classification.length > 0 && (
                                    <div className="mb-1">
                                      {update.classification.map((c, i) => (
                                        <Badge
                                          key={c + i}
                                          variant={classification === c.toLowerCase() ? "default" : "secondary"}
                                          onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setClassification(c.toLowerCase());
                                          }}
                                          className="mr-1 cursor-pointer"
                                        >
                                          {capitalize(c)}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {update.subjects && update.subjects.length > 0 && (
                                    <div className="mb-1">
                                      {update.subjects.map((s, i) => (
                                        <Badge
                                          key={s + i}
                                          variant={subject === s ? "default" : "outline"}
                                          onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setSubject(subject === s ? "" : s);
                                          }}
                                          className="mr-1 cursor-pointer"
                                        >
                                          #{capitalize(s)}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  {update.latestActionDescription && (
                                    <div className="text-sm text-muted-foreground mb-1 text-left">
                                      <span className="font-semibold">Last Action: </span>{update.latestActionDescription}
                                      {formattedLastActionDate && (
                                        <span className="ml-2">({formattedLastActionDate})</span>
                                      )}
                                    </div>
                                  )}
                                  {formattedDate && (
                                    <div className="text-sm text-muted-foreground mb-1">
                                      <span className="font-semibold">Date: </span>{formattedDate}
                                    </div>
                                  )}
                                  {update.sponsors && update.sponsors.length > 0 && (
                                      <div className="mb-1 text-xs text-muted-foreground">
                                        <span className="font-semibold">Sponsors: </span>
                                        {update.sponsors.map((sp: any, i: number) => (
                                            <span key={`${sp.name || ''}-${i}`}>{sp.name}{i < update.sponsors.length - 1 ? ', ' : ''}</span>
                                        ))}
                                      </div>
                                  )}
                                  {update.geminiSummary && (
                                    <div className="mt-2 text-sm text-left">{update.geminiSummary}</div>
                                  )}
                                  {!update.geminiSummary && update.summary && (
                                    <div className="mt-2 text-sm text-left">{update.summary}</div>
                                  )}
                                </div>
                                <div className="mt-auto pt-4 flex justify-start">
                                  <button
                                    type="button"
                                    className="px-3 py-1 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      window.open(stateUrl, '_blank', 'noopener');
                                    }}
                                  >
                                    {update.sources && update.sources.length > 0 ? 'Official State Link' : 'OpenStates Link'}
                                  </button>
                                </div>
                              </div>
                            </Link>
                        );
                      })}
                    </div>
                    <div ref={loader} />
                    {showLoadingText && (loading || isFetchingMore) && (
                      <p className="mt-6 text-center text-muted-foreground">Loading more updates...</p>
                    )}
                    {!hasMore && !loading && <p className="mt-6 text-center text-muted-foreground">No more updates.</p>}
                  </CardContent>
                </Card>
              );
            }