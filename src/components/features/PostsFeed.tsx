"use client";

import {useEffect, useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useRouter} from "next/navigation";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
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

    // Fetch posts on mount
    useEffect(() => {
        fetchPosts();
    }, []);
    const [selectedTag, setSelectedTag] = useState<string>("");
    const {user, isSignedIn} = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [posts, setPosts] = useState<Post[]>([]);
    const allTags = Array.from(new Set(posts.flatMap(post => post.tags))).sort();
    // Removed obsolete showCreatePost state
    const [loading, setLoading] = useState(true);
    // Search/filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
    // Tag filter state




    // Removed obsolete linkedBills normalization effect

    useEffect(() => {
        // Filter posts by search term and selected tag
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
        return (
            <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardHeader>
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="h-3 bg-muted rounded"></div>
                                <div className="h-3 bg-muted rounded w-5/6"></div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
            {/* Create Post Button */}
            {isSignedIn && (
                <div className="w-full mb-2">
                    <Button
                        variant="default"
                        size="lg"
                        className="h-12 w-full text-base flex items-center gap-2 justify-center"
                        onClick={() => router.push('/posts/new')}
                    >
                        <Plus className="h-5 w-5 mr-1" />
                        Create Post
                    </Button>
                </div>
            )}
            {/* Search/Filter Bar (consistent UI) */}
            <div className="mb-4 flex justify-center w-full">
                <div className="flex flex-row gap-2 w-full max-w-4xl">
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
                </div>
            </div>



            {/* Posts Feed */}
            <div className="space-y-3 sm:space-y-4">
                {filteredPosts.length === 0 ? (
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
                    filteredPosts.map((post) => (
                        <AnimatedSection key={post._id}>
                            <PostCard post={post} onPostDeleted={fetchPosts} />
                        </AnimatedSection>
                    ))
                )}
            </div>
        </div>
    );
}
