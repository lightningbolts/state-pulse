"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BellRing, X } from "lucide-react";

export function PolicyTracker({ userId }: { userId: string }) {
  const [input, setInput] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [updates, setUpdates] = useState<{ topic: string; message: string; date: string }[]>([]);

  // Fetch topics and updates from backend
  const fetchUpdates = async () => {
    if (!userId) return;
    const res = await fetch(`/api/policy-tracker?userId=${userId}`);
    if (res.ok) {
      const data = await res.json();
      setUpdates(data.updates || []);
      setTopics([...new Set((data.updates || []).map((u: any) => u.topic))]);
    }
  };

  useEffect(() => {
    fetchUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || topics.includes(trimmed)) return;
    const res = await fetch("/api/policy-tracker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: trimmed, userId }),
    });
    if (res.ok) {
      setInput("");
      fetchUpdates();
    }
  };

  const handleUnsubscribe = (topic: string) => {
    // Optionally implement unsubscribe logic in backend
    setTopics(topics.filter((t) => t !== topic));
    setUpdates(updates.filter((u) => u.topic !== topic));
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Custom Policy Tracking</CardTitle>
        <CardDescription>Subscribe to specific policies or topics (e.g., "abortion laws in Ohio") and receive updates.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubscribe}
          className="flex flex-row w-full items-center gap-2 mb-6 sm:flex-row flex-col"
        >
          <Input
            type="text"
            placeholder="Enter topic to track (e.g., 'minimum wage CA')"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            data-testid="policy-tracker-input"
            className="w-full rounded-lg"
          />
          <Button
            type="submit"
            className="rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground w-full sm:w-auto"
            data-testid="policy-tracker-subscribe"
          >
            <BellRing className="mr-2 h-4 w-4" />
            Subscribe
          </Button>
        </form>
        <div className="mt-6">
          <h4 className="font-semibold mb-2">Your Tracked Topics:</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {topics.length === 0 && (
              <li className="text-muted-foreground">No topics tracked yet.</li>
            )}
            {topics.map((topic) => (
              <li key={topic} className="flex items-center justify-between">
                <span>{topic}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-primary border-primary hover:bg-primary/10"
                    aria-label={`Simulate update for ${topic}`}
                    data-testid={`policy-tracker-simulate-update-${topic}`}
                  >
                    <BellRing className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 text-destructive hover:text-destructive/80"
                    onClick={() => handleUnsubscribe(topic)}
                    aria-label={`Unsubscribe from ${topic}`}
                    data-testid={`policy-tracker-unsubscribe-${topic}`}
                  >
                    <X className="w-4 h-4" />
                    <span className="sr-only">Unsubscribe</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground text-center">Updates on your tracked topics will appear here and/or be sent via notifications.</p>
        </div>
        {updates.length > 0 && (
          <div className="mt-8">
            <h4 className="font-semibold mb-2">Recent Updates</h4>
            <ul className="space-y-2">
              {updates.map((update, idx) => (
                <li key={idx} className="border rounded p-2 bg-muted/50">
                  <div className="font-medium">{update.topic}</div>
                  <div className="text-sm">{update.message}</div>
                  <div className="text-xs text-muted-foreground">{update.date}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
