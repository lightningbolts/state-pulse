"use client";

import React, {useEffect, useState} from "react";
import {useUser} from "@clerk/nextjs";
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from "@/components/ui/card";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {useToast} from "@/hooks/use-toast";
import {
    Ban,
    BellRing,
    Bookmark,
    CalendarDays,
    Check,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    FileText,
    Pencil,
    Users,
    X
} from "lucide-react";
import {BookmarksList} from "@/components/features/BookmarksList";
import {Badge} from "@/components/ui/badge";
import Link from 'next/link';
import {RelatedLegislation} from "@/types/legislation";
import {AnimatedSection} from "@/components/ui/AnimatedSection";

export function PolicyTracker() {
    const {user, isLoaded, isSignedIn} = useUser();
    const userId = user?.id;
    const [input, setInput] = useState("");
    const [topics, setTopics] = useState<string[]>([]);
    const [topicNotifications, setTopicNotifications] = useState<Record<string, boolean>>({});
    const [updates, setUpdates] = useState<{
        topic: string;
        message: string;
        date: string;
    }[]>([]);
    const [editingTopic, setEditingTopic] = useState<string | null>(null);
    const [newTopicValue, setNewTopicValue] = useState("");
    const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
    const [relatedLegislation, setRelatedLegislation] = useState<Record<string, RelatedLegislation[]>>({});
    const [loadingLegislation, setLoadingLegislation] = useState<Set<string>>(new Set());
    const {toast} = useToast();
    // Toggle daily email notification for a topic
    const handleToggleNotification = async (topic: string) => {
        if (!isSignedIn) return;
        const enabled = !topicNotifications[topic];
        const res = await fetch("/api/policy-tracker", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ oldTopic: topic, notifyByEmail: enabled }),
        });
        if (res.ok) {
            setTopicNotifications((prev) => ({ ...prev, [topic]: enabled }));
            toast({
                title: enabled ? `Email notifications enabled for "${topic}"` : `Email notifications disabled for "${topic}"`,
                description: enabled
                    ? "You will receive daily emails if new legislation is found for this topic."
                    : "You will no longer receive daily emails for this topic.",
                variant: "default",
            });
        } else {
            toast({
                title: "Error updating notification",
                description: "Please try again.",
                variant: "destructive",
            });
        }
    };

    // Fetch topics and updates from backend
    const fetchUpdates = async () => {
        if (!userId) return;
        const res = await fetch(`/api/policy-tracker?userId=${userId}`);
        if (res.ok) {
            const data = await res.json();
            setUpdates(data.updates || []);
            const topicStrings = (data.updates || []).map((u: any) => u.topic).filter((topic: any): topic is string => typeof topic === 'string');
            setTopics(Array.from(new Set(topicStrings)));
            // Track notification status for each topic
            const notifications: Record<string, boolean> = {};
            (data.updates || []).forEach((u: any) => {
                if (u.topic) notifications[u.topic] = !!u.notifyByEmail;
            });
            setTopicNotifications(notifications);
        }
    };

    useEffect(() => {
        fetchUpdates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const handleSubscribe = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isSignedIn) {
            // Or show a message to the user
            return;
        }
        const trimmed = input.trim();
        if (!trimmed || topics.includes(trimmed)) return;
        const res = await fetch("/api/policy-tracker", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({topic: trimmed}),
        });
        if (res.ok) {
            setInput("");
            fetchUpdates();
        }
    };

    const handleUnsubscribe = async (topic: string) => {
        if (!isSignedIn) {
            return;
        }
        const res = await fetch("/api/policy-tracker", {
            method: "DELETE",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({topic}),
        });

        if (res.ok) {
            fetchUpdates();
        }
    };

    const handleEdit = (topic: string) => {
        setEditingTopic(topic);
        setNewTopicValue(topic);
    };

    const handleCancelEdit = () => {
        setEditingTopic(null);
        setNewTopicValue("");
    };

    const handleUpdateTopic = async () => {
        if (!isSignedIn || !editingTopic || !newTopicValue) {
            return;
        }
        const res = await fetch("/api/policy-tracker", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({oldTopic: editingTopic, newTopic: newTopicValue}),
        });

        if (res.ok) {
            setEditingTopic(null);
            setNewTopicValue("");
            fetchUpdates();
        }
    };

    const toggleExpandTopic = async (topic: string) => {
        const newExpandedTopics = new Set(expandedTopics);
        if (newExpandedTopics.has(topic)) {
            newExpandedTopics.delete(topic);
        } else {
            newExpandedTopics.add(topic);
            // Fetch related legislation when expanding if not already loaded
            if (!relatedLegislation[topic]) {
                await fetchRelatedLegislation(topic);
            }
        }
        setExpandedTopics(newExpandedTopics);
    };

    const fetchRelatedLegislation = async (topic: string) => {
        if (loadingLegislation.has(topic)) return;

        setLoadingLegislation((prev) => new Set(prev).add(topic));

        try {
            const res = await fetch(`/api/search-legislation-by-topic?topic=${encodeURIComponent(topic)}`);
            if (res.ok) {
                const data = await res.json();
                // console.log('Search results for topic:', topic, data);
                // console.log('Legislation array length:', data.legislation?.length);
                // console.log('Sample legislation:', data.legislation?.[0]);
                setRelatedLegislation((prev) => ({...prev, [topic]: data.legislation || []}));
            } else {
                console.error('Failed to fetch related legislation:', res.statusText);
                setRelatedLegislation((prev) => ({...prev, [topic]: []}));
            }
        } catch (error) {
            console.error('Error fetching related legislation:', error);
            setRelatedLegislation((prev) => ({...prev, [topic]: []}));
        } finally {
            setLoadingLegislation((prev) => {
                const newSet = new Set(prev);
                newSet.delete(topic);
                return newSet;
            });
        }
    };

    return (
        <AnimatedSection>
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center">
                            Track Your Policies
                        </CardTitle>
                        <CardDescription>
                            Monitor specific topics and bookmark legislation you want to follow.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="overflow-hidden">
                        <Tabs defaultValue="topics" className="w-full">
                            <TabsList className="grid w-full grid-cols-2 gap-0">
                                <TabsTrigger value="topics" className="flex items-center justify-center gap-2 text-sm">
                                    <BellRing className="h-4 w-4 flex-shrink-0"/>
                                    <span className="truncate">Topic Tracking</span>
                                </TabsTrigger>
                                <TabsTrigger value="bookmarks"
                                             className="flex items-center justify-center gap-2 text-sm">
                                    <Bookmark className="h-4 w-4 flex-shrink-0"/>
                                    <span className="truncate">Bookmarked Legislation</span>
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="topics" className="mt-6">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2">
                                            Custom Policy Tracking
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4 break-words">
                                            Subscribe to specific policies or topics (e.g., "abortion laws
                                            in Ohio") and receive updates.
                                        </p>
                                    </div>

                                    <form
                                        onSubmit={handleSubscribe}
                                        className="flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-2 mb-6"
                                    >
                                        <Input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Enter a topic to track..."
                                            className="flex-grow min-w-0"
                                            disabled={!isLoaded || !isSignedIn}
                                        />
                                        <Button
                                            type="submit"
                                            disabled={!isLoaded || !isSignedIn}
                                            className="w-full md:w-auto flex-shrink-0 text-sm"
                                        >
                                            <BellRing className="mr-2 h-4 w-4"/>
                                            Add Topic
                                        </Button>
                                    </form>

                                    <div className="space-y-4">
                                        <h4 className="font-semibold mb-2">Your Tracked Topics:</h4>
                                        <ul className="space-y-3 md:space-y-1">
                                            {topics.length === 0 && (
                                                <li className="text-muted-foreground text-sm">
                                                    No topics tracked yet.
                                                </li>
                                            )}
                                            {topics.map((topic) => (
                                                <AnimatedSection key={topic}>
                                                    <li className="space-y-2">
                                                        <div
                                                            className="flex flex-col p-3 md:p-2 border md:border-0 rounded-md md:rounded-none bg-muted/20 md:bg-transparent md:flex-row md:items-center md:justify-between overflow-hidden">
                                                            {editingTopic === topic ? (
                                                                <div
                                                                    className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-grow min-w-0">
                                                                    <Input
                                                                        type="text"
                                                                        value={newTopicValue}
                                                                        onChange={(e) => setNewTopicValue(e.target.value)}
                                                                        className="flex-grow min-w-0"
                                                                    />
                                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                                        <Button size="sm" onClick={handleUpdateTopic}>
                                                                            <Check className="w-4 h-4"/>
                                                                        </Button>
                                                                        <Button size="sm" variant="ghost"
                                                                                onClick={handleCancelEdit}>
                                                                            <Ban className="w-4 h-4"/>
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <span
                                                                        className="font-medium text-sm md:text-base break-words flex-1 mb-2 md:mb-0 min-w-0 overflow-hidden">{topic}</span>
                                                                    <div
                                                                        className="flex items-center gap-1 md:gap-2 flex-shrink-0 flex-wrap">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white flex-shrink-0"
                                                                            onClick={() => toggleExpandTopic(topic)}
                                                                            disabled={loadingLegislation.has(topic)}
                                                                            aria-label={`${expandedTopics.has(topic) ? 'Hide' : 'Show'} recent legislation`}
                                                                        >
                                                                            {loadingLegislation.has(topic) ? (
                                                                                <div
                                                                                    className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600"></div>
                                                                            ) : expandedTopics.has(topic) ? (
                                                                                <ChevronUp className="w-4 h-4"/>
                                                                            ) : (
                                                                                <ChevronDown className="w-4 h-4"/>
                                                                            )}
                                                                        </Button>
                                                                        <Button
                                                                            variant={topicNotifications[topic] ? "default" : "outline"}
                                                                            size="sm"
                                                                            className={
                                                                                `text-sm flex-shrink-0 border rounded-md transition-colors px-3 py-2 ${
                                                                                    topicNotifications[topic]
                                                                                        ? "text-yellow-500 border-yellow-500 bg-yellow-100 hover:bg-yellow-200"
                                                                                        : "text-primary border-primary hover:bg-primary hover:text-white"
                                                                                }`
                                                                            }
                                                                            aria-label={topicNotifications[topic]
                                                                                ? `Disable daily email notifications for ${topic}`
                                                                                : `Enable daily email notifications for ${topic}`}
                                                                            data-testid={`policy-tracker-toggle-email-${topic}`}
                                                                            onClick={() => handleToggleNotification(topic)}
                                                                        >
                                                                            <BellRing className="w-4 h-4"/>
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white flex-shrink-0"
                                                                            onClick={() => handleEdit(topic)}
                                                                            aria-label={`Edit ${topic}`}
                                                                        >
                                                                            <Pencil className="w-4 h-4"/>
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white flex-shrink-0"
                                                                            onClick={() => handleUnsubscribe(topic)}
                                                                            aria-label={`Unsubscribe from ${topic}`}
                                                                            data-testid={`policy-tracker-unsubscribe-${topic}`}
                                                                        >
                                                                            <X className="w-4 h-4"/>
                                                                            <span className="sr-only">Unsubscribe</span>
                                                                        </Button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {expandedTopics.has(topic) && (
                                                            <div className="ml-4 pl-4 border-l-2 border-muted space-y-3">
                                                                {loadingLegislation.has(topic) ? (
                                                                    <div
                                                                        className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                        <div
                                                                            className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                                                                        Loading recent legislation...
                                                                    </div>
                                                                ) : relatedLegislation[topic] ? (
                                                                    relatedLegislation[topic].length === 0 ? (
                                                                        <div
                                                                            className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                                                                            No recent legislation found.
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div
                                                                                    className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                                <p className="text-sm font-medium text-foreground">
                                                                                    Recent legislation
                                                                                    from {relatedLegislation[topic][0]?.jurisdictionName || 'this jurisdiction'}:
                                                                                </p>
                                                                            </div>
                                                                            <div
                                                                                className="text-xs text-muted-foreground mb-2 bg-blue-50 p-2 rounded">
                                                                                Note: Showing general legislation from the
                                                                                detected location since no specific topic
                                                                                matches were found.
                                                                            </div>
                                                                            {relatedLegislation[topic].map((legislation, i) => (
                                                                                <AnimatedSection key={legislation.id}>
                                                                                    <Card
                                                                                        className="hover:shadow-md transition-shadow">
                                                                                        <CardHeader className="pb-2">
                                                                                            <div
                                                                                                className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
                                                                                                <div
                                                                                                    className="flex-1 min-w-0">
                                                                                                    <CardTitle
                                                                                                        className="text-lg md:text-xl mb-2 break-words">
                                                                                                        <Link
                                                                                                            href={`/legislation/${legislation.id}`}
                                                                                                            className="hover:text-primary transition-colors"
                                                                                                        >
                                                                                                            {legislation.identifier}: {legislation.title}
                                                                                                        </Link>
                                                                                                    </CardTitle>
                                                                                                    <div
                                                                                                        className="flex flex-wrap gap-2 mb-2">
                                                                                                        {legislation.statusText && (
                                                                                                            <Badge
                                                                                                                variant="secondary"
                                                                                                                className="text-xs">{legislation.statusText}</Badge>
                                                                                                        )}
                                                                                                        {legislation.classification?.map((type) => (
                                                                                                            <Badge
                                                                                                                key={type}
                                                                                                                variant="outline"
                                                                                                                className="text-xs">{type}</Badge>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                    <p className="text-sm text-muted-foreground break-words">
                                                                                                        {legislation.session} - {legislation.jurisdictionName}
                                                                                                        {legislation.chamber && ` (${legislation.chamber})`}
                                                                                                    </p>
                                                                                                </div>
                                                                                            </div>
                                                                                        </CardHeader>
                                                                                        <CardContent className="pt-0">
                                                                                            <div
                                                                                                className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                                                {legislation.firstActionAt && (
                                                                                                    <div
                                                                                                        className="flex items-center text-sm text-muted-foreground">
                                                                                                        <CalendarDays
                                                                                                            className="mr-2 h-4 w-4"/>
                                                                                                        First
                                                                                                        Action: {new Date(legislation.firstActionAt).toLocaleDateString()}
                                                                                                    </div>
                                                                                                )}
                                                                                                {legislation.latestActionAt && (
                                                                                                    <div
                                                                                                        className="flex items-center text-sm text-muted-foreground">
                                                                                                        <CalendarDays
                                                                                                            className="mr-2 h-4 w-4"/>
                                                                                                        Latest
                                                                                                        Action: {new Date(legislation.latestActionAt).toLocaleDateString()}
                                                                                                    </div>
                                                                                                )}
                                                                                                {legislation.sponsors && legislation.sponsors.length > 0 && (
                                                                                                    <div
                                                                                                        className="flex items-center text-sm text-muted-foreground">
                                                                                                        <Users
                                                                                                            className="mr-2 h-4 w-4"/>
                                                                                                        {legislation.sponsors.length} sponsor{legislation.sponsors.length !== 1 ? 's' : ''}
                                                                                                    </div>
                                                                                                )}
                                                                                                {legislation.abstracts && legislation.abstracts.length > 0 && (
                                                                                                    <div
                                                                                                        className="flex items-center text-sm text-muted-foreground">
                                                                                                        <FileText
                                                                                                            className="mr-2 h-4 w-4"/>
                                                                                                        {legislation.abstracts.length} abstract{legislation.abstracts.length !== 1 ? 's' : ''}
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                            {legislation.subjects && legislation.subjects.length > 0 && (
                                                                                                <div className="mb-4">
                                                                                                    <h4 className="text-sm font-medium mb-2">Subjects:</h4>
                                                                                                    <div
                                                                                                        className="flex flex-wrap gap-1">
                                                                                                        {legislation.subjects.map((subject, idx) => (
                                                                                                            <Badge
                                                                                                                key={subject + '-' + idx}
                                                                                                                variant="default"
                                                                                                                className="text-xs">
                                                                                                                {subject}
                                                                                                            </Badge>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                            {legislation.geminiSummary && (
                                                                                                <div
                                                                                                    className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                                                                                                    <h4 className="text-sm font-medium text-primary mb-2">AI
                                                                                                        Summary:</h4>
                                                                                                    <p className="text-sm text-muted-foreground">
                                                                                                        {legislation.geminiSummary.length > 200
                                                                                                            ? `${legislation.geminiSummary.substring(0, 200)}...`
                                                                                                            : legislation.geminiSummary
                                                                                                        }
                                                                                                    </p>
                                                                                                </div>
                                                                                            )}
                                                                                            <div
                                                                                                className="flex justify-between items-center">
                                                                                                <Link
                                                                                                    href={`/legislation/${legislation.id}`}>
                                                                                                    <Button
                                                                                                        variant="outline"
                                                                                                        size="sm">
                                                                                                        View Details
                                                                                                    </Button>
                                                                                                </Link>
                                                                                                {legislation.openstatesUrl && (
                                                                                                    <Link
                                                                                                        href={legislation.openstatesUrl}
                                                                                                        target="_blank"
                                                                                                        rel="noopener noreferrer"
                                                                                                        className="text-primary hover:underline flex items-center text-sm"
                                                                                                    >
                                                                                                        <ExternalLink
                                                                                                            className="mr-1 h-3 w-3"/>
                                                                                                        OpenStates
                                                                                                    </Link>
                                                                                                )}
                                                                                            </div>
                                                                                        </CardContent>
                                                                                    </Card>
                                                                                </AnimatedSection>
                                                                            ))}
                                                                        </div>
                                                                    )
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </li>
                                                </AnimatedSection>
                                            ))}
                                        </ul>
                                        <p className="mt-4 text-sm text-muted-foreground text-center">
                                            Updates on your tracked topics will appear here and/or be sent
                                            via email.
                                        </p>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="bookmarks" className="mt-6">
                                <div className="space-y-4">
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2">
                                            Bookmarked Legislation
                                        </h3>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            View and manage legislation you've bookmarked for easy access.
                                        </p>
                                    </div>
                                    <BookmarksList/>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>
        </AnimatedSection>
    );
}
