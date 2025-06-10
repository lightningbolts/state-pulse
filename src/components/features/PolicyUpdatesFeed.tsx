"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bookmark, Search } from "lucide-react";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

interface PolicyUpdate {
  id: string;
  title?: string;
  jurisdictionName?: string;
  session?: string;
  subjects?: string[];
  createdAt?: string;
  summary?: string;
}

let cardNumber = 20;

async function fetchUpdatesFeed({ skip = 0, limit = cardNumber, search = "", subject = "", sortField = "createdAt", sortDir = "desc" }) {
  const params = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (search) params.append("search", search);
  if (subject) params.append("subject", subject);
  if (sortField) params.append("sortBy", sortField);
  if (sortDir) params.append("sortDir", sortDir);
  const res = await fetch(`/api/legislation?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch updates");
  return res.json();
}

export function PolicyUpdatesFeed() {
  const [updates, setUpdates] = useState<PolicyUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [sort, setSort] = useState<{ field: string; dir: 'asc' | 'desc' }>({ field: 'createdAt', dir: 'desc' });
  const loader = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newUpdates = await fetchUpdatesFeed({ skip, limit: 25, search, subject, sortField: sort.field, sortDir: sort.dir });
      setUpdates((prev) => [...prev, ...newUpdates]);
      setSkip((prev) => prev + newUpdates.length);
      setHasMore(newUpdates.length === 25);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [skip, loading, hasMore, search, subject, sort]);

  useEffect(() => {
    setUpdates([]);
    setSkip(0);
    setHasMore(true);
  }, [search, subject]);

  useEffect(() => {
    loadMore();
    // eslint-disable-next-line
  }, [search, subject]);

  useEffect(() => {
    if (!loader.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        loadMore();
      }
    });
    observer.observe(loader.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Real-Time Policy Updates</CardTitle>
        <CardDescription>Stay updated with the latest policy developments. Filter by category or search for specific topics.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-grow w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search updates..."
              className="pl-10 w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
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
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="w-full sm:w-auto">
            <Bookmark className="mr-2 h-4 w-4" />
            Bookmarked (0)
          </Button>
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
          {updates.map((update, idx) => (
            <Card key={update.id || idx} className="flex flex-col h-full">
              <div className="flex flex-col flex-1 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{update.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {update.createdAt ? new Date(update.createdAt).toLocaleDateString() : ""}
                      {update.jurisdictionName ? ` - ${update.jurisdictionName}` : ""}
                    </p>
                  </div>
                  <Badge>{update.subjects?.[0] || "Policy"}</Badge>
                </div>
                <p className="mt-2 text-sm flex-1">{update.summary}</p>
                <Button variant="ghost" size="sm" className="mt-2">
                  <Bookmark className="mr-2 h-4 w-4" /> Bookmark
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <div ref={loader} />
        {loading && <p className="mt-6 text-center text-muted-foreground">Loading more updates...</p>}
        {!hasMore && !loading && <p className="mt-6 text-center text-muted-foreground">No more updates.</p>}
      </CardContent>
    </Card>
  );
}
