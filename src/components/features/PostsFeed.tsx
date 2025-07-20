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

export function PostsFeed() {
    const {user, isSignedIn} = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [posts, setPosts] = useState<Post[]>([]);
    const [showCreatePost, setShowCreatePost] = useState(false);
    const [editingPost, setEditingPost] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Create/Edit post state
    const [postType, setPostType] = useState<'legislation' | 'bug_report'>('legislation');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [selectedBills, setSelectedBills] = useState<Bill[]>([]);
    const [showBillSearch, setShowBillSearch] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [currentTag, setCurrentTag] = useState('');

    // Comment state
    const [commentContent, setCommentContent] = useState<{ [postId: string]: string }>({});
    const [showComments, setShowComments] = useState<{ [postId: string]: boolean }>({});
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editCommentContent, setEditCommentContent] = useState<string>('');

    // Reply state
    const [replyContent, setReplyContent] = useState<{ [commentId: string]: string }>({});
    const [showReplyForm, setShowReplyForm] = useState<{ [commentId: string]: boolean }>({});
    const [showReplies, setShowReplies] = useState<{ [commentId: string]: boolean }>({});

    // Search/filter state
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);

    // Tag filter state
    const allTags = Array.from(new Set(posts.flatMap(post => post.tags))).sort();
    const [selectedTag, setSelectedTag] = useState<string>("");

    useEffect(() => {
        fetchPosts();
    }, []);

    useEffect(() => {
        // Filter posts whenever posts or searchTerm changes
        if (!searchTerm.trim()) {
            setFilteredPosts(posts);
        } else {
            const term = searchTerm.toLowerCase();
            setFilteredPosts(
                posts.filter(
                    post =>
                        post.title.toLowerCase().includes(term) ||
                        post.content.toLowerCase().includes(term) ||
                        post.tags.some(tag => tag.toLowerCase().includes(term))
                )
            );
        }
    }, [posts, searchTerm]);

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
            console.error('Error fetching posts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePost = async () => {
        if (!isSignedIn || !title.trim() || !content.trim()) return;

        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: postType,
                    title: title.trim(),
                    content: content.trim(),
                    linkedBills: postType === 'legislation' ? selectedBills : undefined,
                    tags
                })
            });

            if (response.ok) {
                resetCreateForm();
                fetchPosts();
            }
        } catch (error) {
            console.error('Error creating post:', error);
        }
    };

    const handleEditPost = async (postId: string) => {
        if (!isSignedIn) return;

        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    title: title.trim(),
                    content: content.trim(),
                    linkedBills: postType === 'legislation' ? selectedBills : undefined,
                    tags
                })
            });

            if (response.ok) {
                setEditingPost(null);
                resetCreateForm();
                fetchPosts();
            }
        } catch (error) {
            console.error('Error updating post:', error);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!isSignedIn || !confirm('Are you sure you want to delete this post?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPosts();
            }
        } catch (error) {
            console.error('Error deleting post:', error);
        }
    };

    const handleLikePost = async (postId: string) => {
        if (!isSignedIn) return;

        try {
            const response = await fetch(`/api/posts/${postId}/like`, {
                method: 'POST'
            });

            if (response.ok) {
                fetchPosts();
            }
        } catch (error) {
            console.error('Error liking post:', error);
        }
    };

    const handleAddComment = async (postId: string) => {
        if (!isSignedIn || !commentContent[postId]?.trim()) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    content: commentContent[postId].trim()
                })
            });

            if (response.ok) {
                setCommentContent(prev => ({...prev, [postId]: ''}));
                fetchPosts();
            }
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const handleEditComment = async (postId: string, commentId: string) => {
        if (!isSignedIn || !editCommentContent.trim()) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    content: editCommentContent.trim()
                })
            });

            if (response.ok) {
                setEditingComment(null);
                setEditCommentContent('');
                fetchPosts();
            }
        } catch (error) {
            console.error('Error updating comment:', error);
        }
    };

    const handleDeleteComment = async (postId: string, commentId: string) => {
        if (!isSignedIn || !confirm('Are you sure you want to delete this comment?')) return;

        try {
            const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPosts();
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
        }
    };

    const handleAddReply = async (commentId: string, customContent?: string) => {
        const content = customContent || replyContent[commentId];
        if (!isSignedIn || !content?.trim()) return;

        try {
            const response = await fetch(`/api/comments/${commentId}/replies`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    content: content.trim()
                })
            });

            if (response.ok) {
                if (!customContent) {
                    setReplyContent(prev => ({...prev, [commentId]: ''}));
                }
                setShowReplies(prev => ({...prev, [commentId]: true})); // Auto-expand replies
                fetchPosts();
            }
        } catch (error) {
            console.error('Error adding reply:', error);
        }
    };

    const handleEditReply = async (commentId: string, replyId: string) => {
        if (!isSignedIn || !editCommentContent.trim()) return;

        try {
            const response = await fetch(`/api/comments/${commentId}/replies/${replyId}`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    content: editCommentContent.trim()
                })
            });

            if (response.ok) {
                setEditingComment(null);
                setEditCommentContent('');
                fetchPosts();
            }
        } catch (error) {
            console.error('Error updating reply:', error);
        }
    };

    const handleDeleteReply = async (commentId: string, replyId: string) => {
        if (!isSignedIn || !confirm('Are you sure you want to delete this reply?')) return;

        try {
            const response = await fetch(`/api/comments/${commentId}/replies/${replyId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                fetchPosts();
            }
        } catch (error) {
            console.error('Error deleting reply:', error);
        }
    };

    const resetCreateForm = () => {
        setShowCreatePost(false);
        setTitle('');
        setContent('');
        setSelectedBills([]);
        setTags([]);
        setCurrentTag('');
        setShowBillSearch(false);
    };

    const startEditPost = (post: Post) => {
        setEditingPost(post._id);
        setPostType(post.type);
        setTitle(post.title);
        setContent(post.content);
        setSelectedBills(post.linkedBills || []);
        setTags(post.tags);
        setShowCreatePost(true);
    };

    const addTag = () => {
        if (currentTag.trim() && !tags.includes(currentTag.trim())) {
            setTags([...tags, currentTag.trim()]);
            setCurrentTag('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleBillSelect = (bill: Bill) => {
        setSelectedBills(prev => {
            const exists = prev.find(b => b.id === bill.id);
            if (exists) {
                return prev.filter(b => b.id !== bill.id);
            } else {
                return [...prev, bill];
            }
        });
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

            {/* Create Post Button */}
            {!showCreatePost && (
                <AnimatedSection>
                    <Button
                        onClick={() => {
                            if (!isSignedIn) {
                                toast({
                                    title: "Sign in required",
                                    description: "You must be signed in to create a post.",
                                    variant: "destructive"
                                });
                                return;
                            }
                            setShowCreatePost(true);
                        }}
                        className="w-full min-h-[48px] text-sm sm:text-base"
                        size="lg"
                    >
                        <Plus className="h-4 w-4 mr-2"/>
                        Create New Post
                    </Button>
                </AnimatedSection>
            )}

            {/* Create/Edit Post Form */}
            {showCreatePost && isSignedIn && (
                <AnimatedSection>
                    <Card className="mx-0 sm:mx-0">
                        <CardHeader className="pb-3 sm:pb-6">
                            <CardTitle className="flex items-center justify-between text-lg sm:text-xl">
                                <span className="truncate pr-2">{editingPost ? 'Edit Post' : 'Create New Post'}</span>
                                <Button variant="ghost" size="sm" onClick={resetCreateForm} className="flex-shrink-0">
                                    <X className="h-4 w-4"/>
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                            {/* Post Type Selection */}
                            <Tabs value={postType}
                                  onValueChange={(value) => setPostType(value as 'legislation' | 'bug_report')}>
                                <TabsList className="grid w-full grid-cols-2 h-10 sm:h-auto">
                                    <TabsTrigger value="legislation"
                                                 className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                                        <FileText className="h-3 w-3 sm:h-4 sm:w-4"/>
                                        <span className="hidden xs:inline">Legislation</span>
                                        <span className="xs:hidden">Bills</span>
                                    </TabsTrigger>
                                    <TabsTrigger value="bug_report"
                                                 className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                                        <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4"/>
                                        <span className="hidden xs:inline">Bug Report</span>
                                        <span className="xs:hidden">Bug</span>
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Title</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={postType === 'legislation' ? 'Share your thoughts on legislation...' : 'Describe the bug or issue...'}
                                    className="text-sm sm:text-base"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Content</label>
                                <Textarea
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    placeholder={postType === 'legislation' ? 'Explain your position, concerns, or analysis...' : 'Provide details about the bug, steps to reproduce, expected vs actual behavior...'}
                                    rows={4}
                                    className="text-sm sm:text-base resize-none"
                                />
                            </div>

                            {/* Bill Search for Legislation Posts */}
                            {postType === 'legislation' && (
                                <>
                                    <SelectedBills
                                        selectedBills={selectedBills}
                                        onRemoveBill={(billId) => setSelectedBills(prev => prev.filter(b => b.id !== billId))}
                                        onClearAll={() => setSelectedBills([])}
                                        title="Linked Bills"
                                        description="Bills referenced in this post"
                                    />

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-medium">Link Related Bills</label>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setShowBillSearch(!showBillSearch)}
                                                className="text-xs sm:text-sm px-2 sm:px-3"
                                            >
                                                {showBillSearch ? 'Hide' : 'Show'} Search
                                            </Button>
                                        </div>
                                        {showBillSearch && (
                                            <div className="p-3 sm:p-4 bg-muted rounded-lg">
                                                <BillSearch
                                                    selectedBills={selectedBills}
                                                    onBillSelect={handleBillSelect}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {/* Tags */}
                            <div>
                                <label className="block text-sm font-medium mb-2">Tags</label>
                                <div className="flex gap-2 mb-2 flex-wrap sm:flex-nowrap">
                                    <Input
                                        value={currentTag}
                                        onChange={(e) => setCurrentTag(e.target.value)}
                                        placeholder="Add a tag..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addTag();
                                            }
                                        }}
                                        className="flex-1 text-sm sm:text-base"
                                    />
                                    <Button onClick={addTag} variant="outline"
                                            className="px-3 sm:px-4 whitespace-nowrap">
                                        Add
                                    </Button>
                                </div>
                                <div className="flex flex-wrap gap-1 sm:gap-2">
                                    {tags.map((tag) => (
                                        <Badge key={tag} variant="secondary"
                                               className="flex items-center gap-1 text-xs px-2 py-1">
                                            <span className="truncate max-w-[100px] sm:max-w-none">{tag}</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-4 w-4 p-0 hover:bg-transparent"
                                                onClick={() => removeTag(tag)}
                                            >
                                                <X className="h-3 w-3"/>
                                            </Button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <Button
                                onClick={editingPost ? () => handleEditPost(editingPost) : handleCreatePost}
                                className="w-full h-12 sm:h-auto text-sm sm:text-base"
                                disabled={!title.trim() || !content.trim()}
                            >
                                <Save className="h-4 w-4 mr-2"/>
                                {editingPost ? 'Update Post' : 'Create Post'}
                            </Button>
                        </CardContent>
                    </Card>
                </AnimatedSection>
            )}


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
                            <PostCard
                                post={post}
                                user={user}
                                isSignedIn={isSignedIn}
                                router={router}
                                editingPostId={editingPost}
                                startEditPost={startEditPost}
                                handleCancelEditPost={resetCreateForm}
                                handleSavePost={handleEditPost}
                                editTitle={title}
                                setEditTitle={setTitle}
                                editContent={content}
                                setEditContent={setContent}
                                editPostType={postType}
                                setEditPostType={setPostType}
                                editTags={tags}
                                currentTag={currentTag}
                                setCurrentTag={setCurrentTag}
                                addTag={addTag}
                                removeTag={removeTag}
                                editSelectedBills={selectedBills}
                                handleBillSelect={handleBillSelect}
                                editShowBillSearch={showBillSearch}
                                setEditShowBillSearch={setShowBillSearch}
                                handleDeletePost={handleDeletePost}
                                handleLikePost={handleLikePost}
                                showComments={showComments}
                                setShowComments={setShowComments}
                                commentContent={commentContent}
                                setCommentContent={setCommentContent}
                                handleAddComment={handleAddComment}
                                editingComment={editingComment}
                                setEditingComment={setEditingComment}
                                editCommentContent={editCommentContent}
                                setEditCommentContent={setEditCommentContent}
                                handleEditComment={handleEditComment}
                                handleDeleteComment={handleDeleteComment}
                                showReplyForm={showReplyForm}
                                setShowReplyForm={setShowReplyForm}
                                replyContent={replyContent}
                                setReplyContent={setReplyContent}
                                handleAddReply={handleAddReply}
                                showReplies={showReplies}
                                setShowReplies={setShowReplies}
                                handleDeleteReply={handleDeleteReply}
                                editingReply={null}
                                setEditingReply={() => {}}
                                editReplyContent={editCommentContent}
                                setEditReplyContent={setEditCommentContent}
                                handleEditReply={handleEditReply}
                            />
                        </AnimatedSection>
                    ))
                )}
            </div>
        </div>
    );
}
