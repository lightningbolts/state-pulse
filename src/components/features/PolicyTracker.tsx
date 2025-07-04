"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BellRing, X, Pencil, Check, Ban, Bookmark, ChevronDown, ChevronUp, ExternalLink, CalendarDays, Users, FileText } from "lucide-react";
import { BookmarksList } from "@/components/features/BookmarksList";
import { Badge } from "@/components/ui/badge";
import Link from 'next/link';

interface RelatedLegislation {
	id: string;
	title?: string;
	identifier?: string;
	jurisdictionName?: string;
	latestActionAt?: Date;
	latestActionDescription?: string;
	subjects?: string[];
	stateLegislatureUrl?: string;
}

export function PolicyTracker() {
	const { user, isLoaded, isSignedIn } = useUser();
	const userId = user?.id;
	const [input, setInput] = useState("");
	const [topics, setTopics] = useState<string[]>([]);
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

	// Fetch topics and updates from backend
	const fetchUpdates = async () => {
		if (!userId) return;
		const res = await fetch(`/api/policy-tracker?userId=${userId}`);
		if (res.ok) {
			const data = await res.json();
			setUpdates(data.updates || []);
			const topicStrings = (data.updates || []).map((u: any) => u.topic).filter((topic: any): topic is string => typeof topic === 'string');
			setTopics([...new Set(topicStrings)]);
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
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ topic: trimmed }),
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
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ topic }),
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
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ oldTopic: editingTopic, newTopic: newTopicValue }),
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
				console.log('Search results for topic:', topic, data);
				setRelatedLegislation((prev) => ({ ...prev, [topic]: data.legislation }));
			} else {
				console.error('Failed to fetch related legislation:', res.statusText);
				setRelatedLegislation((prev) => ({ ...prev, [topic]: [] }));
			}
		} catch (error) {
			console.error('Error fetching related legislation:', error);
			setRelatedLegislation((prev) => ({ ...prev, [topic]: [] }));
		} finally {
			setLoadingLegislation((prev) => {
				const newSet = new Set(prev);
				newSet.delete(topic);
				return newSet;
			});
		}
	};

	return (
		<div className="space-y-6">
			<Card className="shadow-lg">
				<CardHeader>
					<CardTitle className="font-headline text-2xl flex items-center">
						<BellRing className="mr-3 h-7 w-7" />
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
								<BellRing className="h-4 w-4 flex-shrink-0" />
								<span className="truncate">Topic Tracking</span>
							</TabsTrigger>
							<TabsTrigger value="bookmarks" className="flex items-center justify-center gap-2 text-sm">
								<Bookmark className="h-4 w-4 flex-shrink-0" />
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
										<BellRing className="mr-2 h-4 w-4" />
										Subscribe
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
											<li key={topic} className="space-y-2">
												<div className="flex flex-col p-3 md:p-2 border md:border-0 rounded-md md:rounded-none bg-muted/20 md:bg-transparent md:flex-row md:items-center md:justify-between overflow-hidden">
													{editingTopic === topic ? (
														<div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 flex-grow min-w-0">
															<Input
																type="text"
																value={newTopicValue}
																onChange={(e) => setNewTopicValue(e.target.value)}
																className="flex-grow min-w-0"
															/>
															<div className="flex items-center gap-2 flex-shrink-0">
																<Button size="sm" onClick={handleUpdateTopic}>
																	<Check className="w-4 h-4" />
																</Button>
																<Button size="sm" variant="ghost" onClick={handleCancelEdit}>
																	<Ban className="w-4 h-4" />
																</Button>
															</div>
														</div>
													) : (
														<>
															<span className="font-medium text-sm md:text-base break-words flex-1 mb-2 md:mb-0 min-w-0 overflow-hidden">{topic}</span>
															<div className="flex items-center gap-1 md:gap-2 flex-shrink-0 flex-wrap">
																<Button
																	variant="outline"
																	size="sm"
																	className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white flex-shrink-0"
																	onClick={() => toggleExpandTopic(topic)}
																	disabled={loadingLegislation.has(topic)}
																	aria-label={`${expandedTopics.has(topic) ? 'Hide' : 'Show'} recent legislation`}
																>
																	{loadingLegislation.has(topic) ? (
																		<div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-green-600"></div>
																	) : expandedTopics.has(topic) ? (
																		<ChevronUp className="w-4 h-4" />
																	) : (
																		<ChevronDown className="w-4 h-4" />
																	)}
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	className="text-primary border-primary hover:bg-primary hover:text-white flex-shrink-0"
																	aria-label={`Simulate update for ${topic}`}
																	data-testid={`policy-tracker-simulate-update-${topic}`}
																>
																	<BellRing className="w-4 h-4" />
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	className="text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white flex-shrink-0"
																	onClick={() => handleEdit(topic)}
																	aria-label={`Edit ${topic}`}
																>
																	<Pencil className="w-4 h-4" />
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white flex-shrink-0"
																	onClick={() => handleUnsubscribe(topic)}
																	aria-label={`Unsubscribe from ${topic}`}
																	data-testid={`policy-tracker-unsubscribe-${topic}`}
																>
																	<X className="w-4 h-4" />
																	<span className="sr-only">Unsubscribe</span>
																</Button>
															</div>
														</>
													)}
												</div>

												{expandedTopics.has(topic) && (
													<div className="ml-4 pl-4 border-l-2 border-muted space-y-3">
														{loadingLegislation.has(topic) ? (
															<div className="flex items-center gap-2 text-sm text-muted-foreground">
																<div className="w-4 h-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
																Loading recent legislation...
															</div>
														) : relatedLegislation[topic] ? (
															relatedLegislation[topic].length === 0 ? (
																<div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
																	No recent legislation found.
																</div>
															) : (
																<div className="space-y-3">
																	<div className="flex items-center gap-2">
																		<div className="w-2 h-2 bg-green-500 rounded-full"></div>
																		<p className="text-sm font-medium text-foreground">
																			Recent legislation:
																		</p>
																	</div>
																	{relatedLegislation[topic].map((legislation) => (
																		<Card key={legislation.id} className="hover:shadow-md transition-shadow">
																			<CardHeader className="pb-2">
																				<div className="flex flex-col md:flex-row md:justify-between md:items-start gap-3 md:gap-4">
																					<div className="flex-1 min-w-0">
																						<CardTitle className="text-lg md:text-xl mb-2 break-words">
																							{legislation.identifier && `${legislation.identifier}: `}
																							{legislation.title || 'Untitled Legislation'}
																						</CardTitle>
																						<div className="flex flex-wrap gap-2 mb-2">
																							{legislation.subjects?.slice(0, 2).map((subject, idx) => (
																								<Badge key={idx} variant="outline" className="text-xs">{subject}</Badge>
																							))}
																						</div>
																						<p className="text-sm text-muted-foreground break-words">
																							{legislation.jurisdictionName}
																						</p>
																					</div>
																				</div>
																			</CardHeader>

																			<CardContent className="pt-0">
																				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
																					{legislation.latestActionAt && (
																						<div className="flex items-center text-sm text-muted-foreground">
																							<CalendarDays className="mr-2 h-4 w-4" />
																							Latest Action: {new Date(legislation.latestActionAt).toLocaleDateString()}
																						</div>
																					)}

																					{legislation.subjects && legislation.subjects.length > 0 && (
																						<div className="flex items-center text-sm text-muted-foreground">
																							<FileText className="mr-2 h-4 w-4" />
																							{legislation.subjects.length} subject{legislation.subjects.length !== 1 ? 's' : ''}
																						</div>
																					)}
																				</div>

																				{legislation.latestActionDescription && (
																					<div className="mb-4">
																						<p className="text-sm text-muted-foreground">
																							<strong>Latest Action:</strong> {legislation.latestActionDescription}
																						</p>
																					</div>
																				)}

																				<div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
																					<div className="text-xs text-muted-foreground">
																						Recent legislation
																					</div>
																					<div className="flex gap-2">
																						{legislation.stateLegislatureUrl && (
																							<Button
																								variant="outline"
																								size="sm"
																								onClick={() => window.open(legislation.stateLegislatureUrl, "_blank")}
																							>
																								<ExternalLink className="mr-2 h-4 w-4" />
																								View Bill
																							</Button>
																						)}
																					</div>
																				</div>
																			</CardContent>
																		</Card>
																	))}
																</div>
															)
														) : null}
													</div>
												)}
											</li>
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
								<BookmarksList />
							</div>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</div>
	);
}
