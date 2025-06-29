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
import { BellRing, X, Pencil, Check, Ban, Bookmark } from "lucide-react";
import { BookmarksList } from "@/components/features/BookmarksList";

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
		if (!isSignedIn) {
			// Or show a message to the user
			return;
		}
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
				<CardContent>
					<Tabs defaultValue="topics" className="w-full">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="topics" className="flex items-center gap-2">
								<BellRing className="h-4 w-4" />
								Topic Tracking
							</TabsTrigger>
							<TabsTrigger value="bookmarks" className="flex items-center gap-2">
								<Bookmark className="h-4 w-4" />
								Bookmarked Legislation
							</TabsTrigger>
						</TabsList>

						<TabsContent value="topics" className="mt-6">
							<div className="space-y-4">
								<div>
									<h3 className="font-semibold text-lg mb-2">
										Custom Policy Tracking
									</h3>
									<p className="text-sm text-muted-foreground mb-4">
										Subscribe to specific policies or topics (e.g., "abortion laws
										in Ohio") and receive updates.
									</p>
								</div>

								<form
									onSubmit={handleSubscribe}
									className="flex items-center gap-2 mb-6"
								>
									<Input
										type="text"
										value={input}
										onChange={(e) => setInput(e.target.value)}
										placeholder="Enter a topic to track (e.g., 'AI', 'healthcare')"
										className="flex-grow"
										disabled={!isLoaded || !isSignedIn}
									/>
									<Button type="submit" disabled={!isLoaded || !isSignedIn}>
										<BellRing className="mr-2 h-4 w-4" />
										Subscribe
									</Button>
								</form>

								<div className="space-y-4">
									<h4 className="font-semibold mb-2">Your Tracked Topics:</h4>
									<ul className="list-disc list-inside space-y-1 text-sm">
										{topics.length === 0 && (
											<li className="text-muted-foreground">
												No topics tracked yet.
											</li>
										)}
										{topics.map((topic) => (
											<li key={topic} className="flex items-center justify-between">
												{editingTopic === topic ? (
													<div className="flex items-center gap-2 flex-grow">
														<Input
															type="text"
															value={newTopicValue}
															onChange={(e) => setNewTopicValue(e.target.value)}
															className="flex-grow"
														/>
														<Button size="icon" onClick={handleUpdateTopic}>
															<Check className="w-4 h-4" />
														</Button>
														<Button size="icon" variant="ghost" onClick={handleCancelEdit}>
															<Ban className="w-4 h-4" />
														</Button>
													</div>
												) : (
													<>
														<span>{topic}</span>
														<div className="flex items-center gap-2">
															<Button
																variant="outline"
																size="icon"
																className="text-primary border-primary hover:bg-primary hover:text-white"
																aria-label={`Simulate update for ${topic}`}
																data-testid={`policy-tracker-simulate-update-${topic}`}
															>
																<BellRing className="w-4 h-4" />
															</Button>
															<Button
																variant="outline"
																size="icon"
																className="text-blue-500 border-blue-500 hover:bg-blue-500 hover:text-white"
																onClick={() => handleEdit(topic)}
																aria-label={`Edit ${topic}`}
															>
																<Pencil className="w-4 h-4" />
															</Button>
															<Button
																variant="outline"
																size="icon"
																className="text-red-500 border-red-500 hover:bg-red-500 hover:text-white"
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
