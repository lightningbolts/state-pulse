"use client";

import {useEffect, useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useRouter} from "next/navigation";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {LoadingOverlay} from "@/components/ui/LoadingOverlay";
import {Textarea} from "@/components/ui/textarea";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {Badge} from "@/components/ui/badge";
import {DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem} from "@/components/ui/dropdown-menu";
import {AlertTriangle, Edit, FileText, Heart, MessageCircle, MessageSquare, Plus, Save, Trash2, X, Search} from "lucide-react";
import {BillSearch} from "./BillSearch";
import {SelectedBills} from "./SelectedBills";
import {Bill} from "@/types/legislation";
import {Post} from "@/types/media";
import {AnimatedSection} from "@/components/ui/AnimatedSection";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { PostCard } from "./PostCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PostsFeed() {
    const [sortBy, setSortBy] = useState('newest');
    const sortOptions = [
        { label: 'Newest', value: 'newest' },
        { label: 'Hot', value: 'hot' },
        { label: 'Top', value: 'top' },
        { label: 'Oldest', value: 'oldest' },
    ];
    const [selectedTag, setSelectedTag] = useState<string>("");
    const {user, isSignedIn} = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newType, setNewType] = useState<'legislation' | 'bug_report'>('legislation');
    const [newTags, setNewTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState("");
    const [newBills, setNewBills] = useState<any[]>([]);
    const [showBillSearch, setShowBillSearch] = useState(false);
    const [creating, setCreating] = useState(false);
    const allTags = Array.from(new Set(posts.flatMap(post => post.tags))).sort();
    const getSortedPosts = () => {
        let sorted = [...filteredPosts];
        switch (sortBy) {
            case 'oldest':
                sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                break;
            case 'top':
                sorted.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));
                break;
            case 'hot':
                sorted.sort((a, b) => {
                    const now = Date.now();
                    const score = (post: any) => {
                        const hours = Math.max(1, (now - new Date(post.createdAt).getTime()) / 36e5);
                        return (post.likes?.length || 0) / hours;
                    };
                    return score(b) - score(a);
                });
                break;
            case 'newest':
            default:
                sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                break;
        }
        return sorted;
    };

    useEffect(() => {
        fetchPosts();
    }, []);

    useEffect(() => {
        let filtered = posts;
        if (selectedTag) {
            filtered = filtered.filter(post => post.tags.includes(selectedTag));
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                post =>
                    post.title.toLowerCase().includes(term) ||
                    post.content.toLowerCase().includes(term) ||
                    post.tags.some(tag => tag.toLowerCase().includes(term))
            );
        }
        setFilteredPosts(filtered);
    }, [posts, searchTerm, selectedTag]);

    const fetchPosts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/posts');
            if (response.ok) {
                const data = await response.json();
                setPosts(data.posts || []);
            }
        } catch (error) {
            // Optionally log error
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingOverlay text="Loading posts..." smallText="Loading..." />;
    }

    const handleCreatePost = async () => {
        if (!newTitle.trim() || !newContent.trim()) return;
        setCreating(true);
        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    content: newContent.trim(),
                    type: newType,
                    tags: newTags,
                    linkedBills: newType === 'legislation' ? newBills : undefined
                })
            });
            if (response.ok) {
                setShowCreateForm(false);
                setNewTitle("");
                setNewContent("");
                setNewType('legislation');
                setNewTags([]);
                setNewBills([]);
                setShowBillSearch(false);
                fetchPosts();
            }
        } finally {
            setCreating(false);
        }
    };

    // Update a post in the posts state after edit
    const handlePostUpdated = (updatedPost: Post) => {
        setPosts(prevPosts => prevPosts.map(p => p._id === updatedPost._id ? updatedPost : p));
    };

    return (
        <div className="space-y-4 sm:space-y-6 px-2 sm:px-0 relative">
            {creating && <LoadingOverlay text="Creating post..." smallText="Creating..." />}
            {/* Inline Create Post */}
            <div className="w-full mb-4">
                {!showCreateForm ? (
                    <Button
                        variant="default"
                        size="lg"
                        className="h-12 w-full text-base flex items-center gap-2 justify-center"
                        onClick={() => {
                            if (!isSignedIn) {
                                router.push('/sign-up');
                            } else {
                                setShowCreateForm(true);
                            }
                        }}
                    >
                        <Plus className="h-5 w-5 mr-1" />
                        Create Post
                    </Button>
                ) : (
                    <Card className="w-full">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-bold">Create New Post</h2>
                                    <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}><X className="h-5 w-5" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="text-base" />
                                {/* Type selector above content */}
                                <div>
                                    <label className="block text-sm font-medium mb-1">Type</label>
                                    <Tabs
                                        value={newType}
                                        onValueChange={v => {
                                            setNewType(v as 'legislation' | 'bug_report');
                                            if (v !== 'legislation') {
                                                setNewBills([]);
                                                setShowBillSearch(false);
                                            }
                                        }}
                                    >
                                        <TabsList className="grid grid-cols-2 w-full">
                                            <TabsTrigger value="legislation">Legislation</TabsTrigger>
                                            <TabsTrigger value="bug_report">Bug Report</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                </div>
                                <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Content" rows={5} className="text-base" />
                                {/* Linked Bills section below content */}
                                {newType === 'legislation' && (
                                    <div className="space-y-2">
                                        <SelectedBills
                                            selectedBills={newBills}
                                            onRemoveBill={billId => setNewBills(newBills.filter(b => b.id !== billId))}
                                            onClearAll={() => setNewBills([])}
                                            title="Linked Bills"
                                            description="Bills referenced in this post"
                                        />
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-medium">Link Related Bills</label>
                                                <Button variant="outline" size="sm" onClick={() => setShowBillSearch(!showBillSearch)} className="text-xs px-2">{showBillSearch ? 'Hide' : 'Show'} Search</Button>
                                            </div>
                                            {showBillSearch && (
                                                <div className="p-3 bg-muted rounded-lg">
                                                    <BillSearch selectedBills={newBills} onBillSelect={bill => {
                                                        if (!bill || !bill.id) return;
                                                        setNewBills(prev => {
                                                            const exists = prev.find(b => b.id === bill.id);
                                                            if (exists) {
                                                                return prev.filter(b => b.id !== bill.id);
                                                            } else {
                                                                return [...prev, bill];
                                                            }
                                                        });
                                                    }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium mb-2">Tags</label>
                                    <div className="flex gap-2 mb-2">
                                        <Input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="Add a tag..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newTagInput.trim() && !newTags.includes(newTagInput.trim())) { setNewTags([...newTags, newTagInput.trim()]); setNewTagInput(''); } } }} className="flex-1" />
                                        <Button onClick={() => { if (newTagInput.trim() && !newTags.includes(newTagInput.trim())) { setNewTags([...newTags, newTagInput.trim()]); setNewTagInput(''); } }} variant="outline">Add</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {newTags.map(tag => (
                                            <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs px-2 py-1">
                                                <span>{tag}</span>
                                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0" onClick={() => setNewTags(newTags.filter(t => t !== tag))}><X className="h-3 w-3" /></Button>
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                                    <Button onClick={async () => {
                                        await handleCreatePost();
                                        setShowCreateForm(false);
                                        setNewTitle("");
                                        setNewContent("");
                                        setNewType('legislation');
                                        setNewTags([]);
                                        setNewBills([]);
                                        setShowBillSearch(false);
                                    }} disabled={!newTitle.trim() || !newContent.trim() || creating}>{creating ? 'Creating...' : 'Create'}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            {/* Search/Filter Bar (consistent UI) */}

            {/* Search/Filter/Sort Bar (horizontal on desktop, vertical on mobile) */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full max-w-4xl mx-auto">
                <div className="flex flex-row gap-2 flex-1">
                    <div className="relative flex-1">
                        <Input
                            type="text"
                            placeholder="Search posts by title, content, or tag..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10 h-12 text-base"
                            style={{height: '48px'}}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            <Search className="h-5 w-5" />
                        </span>
                    </div>
                    <Button
                        type="button"
                        variant="default"
                        size="lg"
                        className="h-12 px-6 text-base"
                        style={{height: '48px'}}
                        onClick={() => setSearchTerm(searchTerm.trim())}
                    >
                        Enter
                    </Button>
                </div>
                <div className="flex flex-row gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="lg" className="h-12 min-w-[120px] text-base flex items-center gap-2" style={{height: '48px'}}>
                                {selectedTag ? (
                                    <Badge variant="secondary" className="text-xs">{selectedTag}</Badge>
                                ) : (
                                    <span className="text-base text-muted-foreground">Filter by tag</span>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedTag("")}>All</DropdownMenuItem>
                            {allTags.map(tag => (
                                <DropdownMenuItem key={tag} onClick={() => setSelectedTag(tag)}>
                                    <Badge variant="secondary" className="text-xs mr-2">{tag}</Badge>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="lg" className="h-12 min-w-[120px] text-base flex items-center gap-2" style={{height: '48px'}}>
                                <span className="text-base text-muted-foreground">Sort by:</span>
                                <Badge variant="secondary" className="text-xs ml-2">
                                    {sortOptions.find(opt => opt.value === sortBy)?.label}
                                </Badge>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {sortOptions.map(opt => (
                                <DropdownMenuItem key={opt.value} onClick={() => setSortBy(opt.value)}>
                                    <Badge variant={sortBy === opt.value ? "default" : "secondary"} className="text-xs mr-2">{opt.label}</Badge>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Posts Feed */}
            <div className="space-y-3 sm:space-y-4">
                {getSortedPosts().length === 0 ? (
                    <AnimatedSection>
                        <Card>
                            <CardContent className="text-center py-6 sm:py-8">
                                <MessageSquare className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4"/>
                                <h3 className="text-base sm:text-lg font-medium text-muted-foreground mb-2">No posts found</h3>
                                <p className="text-sm text-muted-foreground">Try a different search term or clear the filter.</p>
                            </CardContent>
                        </Card>
                    </AnimatedSection>
                ) : (
                    getSortedPosts().map((post) => (
                        <AnimatedSection key={post._id}>
                            <PostCard post={post} onPostDeleted={fetchPosts} onPostUpdated={handlePostUpdated} />
                        </AnimatedSection>
                    ))
                )}
            </div>
        </div>
    );
}
