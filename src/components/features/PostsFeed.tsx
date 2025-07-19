"use client";

import {useEffect, useState} from "react";
import {useUser} from "@clerk/nextjs";
import {useRouter} from "next/navigation";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Textarea} from "@/components/ui/textarea";
import {Input} from "@/components/ui/input";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Badge} from "@/components/ui/badge";
import {AlertTriangle, Edit, FileText, Heart, MessageCircle, MessageSquare, Plus, Save, Trash2, X} from "lucide-react";
import {BillSearch} from "./BillSearch";
import {SelectedBills} from "./SelectedBills";
import {Bill} from "@/types/legislation";
import {Post} from "@/types/media";
import {AnimatedSection} from "@/components/ui/AnimatedSection";
import Link from "next/link";

export function PostsFeed() {
    const {user, isSignedIn} = useUser();
    const router = useRouter();
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

    useEffect(() => {
        fetchPosts();
    }, []);

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
            {/* Create Post Button */}
            {isSignedIn && !showCreatePost && (
                <AnimatedSection>
                    <Button
                        onClick={() => setShowCreatePost(true)}
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
                {posts.length === 0 ? (
                    <AnimatedSection>
                        <Card>
                            <CardContent className="text-center py-6 sm:py-8">
                                <MessageSquare
                                    className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4"/>
                                <h3 className="text-base sm:text-lg font-medium text-muted-foreground mb-2">
                                    No posts yet
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Be the first to share your thoughts on legislation or report a bug!
                                </p>
                            </CardContent>
                        </Card>
                    </AnimatedSection>
                ) : (
                    posts.map((post) => (
                        <AnimatedSection key={post._id}>
                            <Card className="mx-0 sm:mx-0">
                                <CardHeader className="pb-3 sm:pb-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                            {post.userImage && (
                                                <img
                                                    src={post.userImage}
                                                    alt={post.username}
                                                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                                                    onClick={() => router.push(`/users/${post.userId}`)}
                                                />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                          <span
                              className="font-medium text-sm sm:text-base truncate cursor-pointer hover:text-primary transition-colors"
                              onClick={() => router.push(`/users/${post.userId}`)}
                          >
                            {post.username}
                          </span>
                                                    <Badge
                                                        variant={post.type === 'legislation' ? 'default' : 'destructive'}
                                                        className="text-xs px-2 py-0.5">
                                                        {post.type === 'legislation' ? (
                                                            <>
                                                                <FileText className="h-3 w-3 mr-1"/>
                                                                <span className="hidden xs:inline">Legislation</span>
                                                                <span className="xs:hidden">Bills</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertTriangle className="h-3 w-3 mr-1"/>
                                                                <span className="hidden xs:inline">Bug Report</span>
                                                                <span className="xs:hidden">Bug</span>
                                                            </>
                                                        )}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs sm:text-sm text-muted-foreground">
                                                    {new Date(post.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Post Actions for Owner */}
                                        {isSignedIn && user?.id === post.userId && (
                                            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEditPost(post)}
                                                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                                                >
                                                    <Edit className="h-3 w-3 sm:h-4 sm:w-4"/>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeletePost(post._id)}
                                                    className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                                                >
                                                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4"/>
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <CardTitle className="text-base sm:text-lg leading-tight">
                                        <Link href={`/posts/${post._id}`} className="text-blue-600 hover:underline">
                                            {post.title}
                                        </Link>
                                    </CardTitle>
                                </CardHeader>

                                <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                                    <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{post.content}</p>

                                    {/* Linked Bills */}
                                    {post.linkedBills && post.linkedBills.length > 0 && (
                                        <div className="mt-3 sm:mt-4">
                                            <SelectedBills
                                                selectedBills={post.linkedBills}
                                                onRemoveBill={() => {
                                                }} // Read-only
                                                onClearAll={() => {
                                                }} // Read-only
                                                title="Referenced Bills"
                                                description="Bills discussed in this post"
                                                readOnly={true}
                                            />
                                        </div>
                                    )}

                                    {/* Tags */}
                                    {post.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 sm:gap-2">
                                            {post.tags.map((tag) => (
                                                <Badge key={tag} variant="outline" className="text-xs px-2 py-0.5">
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}

                                    {/* Post Actions */}
                                    <div className="flex items-center justify-between pt-3 sm:pt-4 border-t">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleLikePost(post._id)}
                                                className={`flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 ${
                                                    isSignedIn && post.likes.includes(user?.id || '')
                                                        ? 'text-red-500'
                                                        : ''
                                                }`}
                                            >
                                                <Heart className={`h-4 w-4 ${
                                                    isSignedIn && post.likes.includes(user?.id || '')
                                                        ? 'fill-current'
                                                        : ''
                                                }`}/>
                                                <span className="text-sm">{post.likes.length}</span>
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowComments(prev => ({
                                                    ...prev,
                                                    [post._id]: !prev[post._id]
                                                }))}
                                                className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
                                            >
                                                <MessageCircle className="h-4 w-4"/>
                                                <span className="text-sm">{post.comments.length}</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Comments Section */}
                                    {showComments[post._id] && (
                                        <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
                                            {/* Add Comment */}
                                            {isSignedIn && (
                                                <div className="space-y-2">
                                                    <Textarea
                                                        value={commentContent[post._id] || ''}
                                                        onChange={(e) => setCommentContent(prev => ({
                                                            ...prev,
                                                            [post._id]: e.target.value
                                                        }))}
                                                        placeholder="Write a comment..."
                                                        rows={2}
                                                        className="text-sm resize-none"
                                                    />
                                                    <div className="flex justify-end">
                                                        <Button
                                                            onClick={() => handleAddComment(post._id)}
                                                            disabled={!commentContent[post._id]?.trim()}
                                                            size="sm"
                                                            className="px-4 sm:px-6"
                                                        >
                                                            Post
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Comments List */}
                                            <div className="space-y-2 sm:space-y-3">
                                                {post.comments.map((comment) => (
                                                    <div key={comment._id}
                                                         className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-muted rounded-lg">
                                                        {comment.userImage && (
                                                            <img
                                                                src={comment.userImage}
                                                                alt={comment.username}
                                                                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                                                                onClick={() => router.push(`/users/${comment.userId}`)}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span
                                      className="font-medium text-xs sm:text-sm cursor-pointer hover:text-primary transition-colors"
                                      onClick={() => router.push(`/users/${comment.userId}`)}
                                  >
                                    {comment.username}
                                  </span>
                                                                    <span className="text-xs text-muted-foreground">
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                  </span>
                                                                </div>

                                                                {/* Edit/Delete Comment Actions - Aligned to the right */}
                                                                {isSignedIn && user?.id === comment.userId && (
                                                                    <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setEditingComment(comment._id);
                                                                                setEditCommentContent(comment.content);
                                                                            }}
                                                                            className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                                                                        >
                                                                            <Edit className="h-3 w-3"/>
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteComment(post._id, comment._id)}
                                                                            className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                                                                        >
                                                                            <Trash2 className="h-3 w-3"/>
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Comment Content */}
                                                            {editingComment === comment._id ? (
                                                                <div className="space-y-2">
                                                                    <Textarea
                                                                        value={editCommentContent}
                                                                        onChange={(e) => setEditCommentContent(e.target.value)}
                                                                        placeholder="Edit your comment..."
                                                                        rows={2}
                                                                        className="text-sm resize-none"
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button
                                                                            onClick={() => setEditingComment(null)}
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="px-3 sm:px-4"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => handleEditComment(post._id, comment._id)}
                                                                            disabled={!editCommentContent.trim()}
                                                                            size="sm"
                                                                            className="px-3 sm:px-4"
                                                                        >
                                                                            Save
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="text-xs sm:text-sm leading-relaxed">{comment.content}</p>

                                                                    {/* Reply Button */}
                                                                    {isSignedIn && (
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => setShowReplyForm(prev => ({
                                                                                    ...prev,
                                                                                    [comment._id]: !prev[comment._id]
                                                                                }))}
                                                                                className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                                                                            >
                                                                                Reply
                                                                            </Button>

                                                                            {/* Show/Hide Replies Toggle */}
                                                                            {comment.replies && comment.replies.length > 0 && (
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    onClick={() => setShowReplies(prev => ({
                                                                                        ...prev,
                                                                                        [comment._id]: !prev[comment._id]
                                                                                    }))}
                                                                                    className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                                                                                >
                                                                                    {showReplies[comment._id] ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                                                                </Button>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Reply Form */}
                                                                    {showReplyForm[comment._id] && isSignedIn && (
                                                                        <div className="mt-3 space-y-2">
                                                                            <Textarea
                                                                                value={replyContent[comment._id] || ''}
                                                                                onChange={(e) => setReplyContent(prev => ({
                                                                                    ...prev,
                                                                                    [comment._id]: e.target.value
                                                                                }))}
                                                                                placeholder="Write a reply..."
                                                                                rows={2}
                                                                                className="text-sm resize-none"
                                                                            />
                                                                            <div className="flex justify-end gap-2">
                                                                                <Button
                                                                                    onClick={() => setShowReplyForm(prev => ({
                                                                                        ...prev,
                                                                                        [comment._id]: false
                                                                                    }))}
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="px-3 sm:px-4"
                                                                                >
                                                                                    Cancel
                                                                                </Button>
                                                                                <Button
                                                                                    onClick={() => handleAddReply(comment._id)}
                                                                                    disabled={!replyContent[comment._id]?.trim()}
                                                                                    size="sm"
                                                                                    className="px-3 sm:px-4"
                                                                                >
                                                                                    Reply
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}

                                                            {/* Replies Section - Nested Comments */}
                                                            {showReplies[comment._id] && comment.replies && comment.replies.length > 0 && (
                                                                <div
                                                                    className="mt-3 ml-4 space-y-2 border-l-2 border-muted pl-4">
                                                                    {comment.replies.map((reply) => (
                                                                        <div key={reply._id}
                                                                             className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-lg border">
                                                                            {reply.userImage && (
                                                                                <img
                                                                                    src={reply.userImage}
                                                                                    alt={reply.username}
                                                                                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                                                                                    onClick={() => router.push(`/users/${reply.userId}`)}
                                                                                />
                                                                            )}
                                                                            <div className="flex-1 min-w-0">
                                                                                <div
                                                                                    className="flex items-start justify-between gap-2">
                                                                                    <div
                                                                                        className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span
                                                className="font-medium text-xs cursor-pointer hover:text-primary transition-colors"
                                                onClick={() => router.push(`/users/${reply.userId}`)}
                                            >
                                              {reply.username}
                                            </span>
                                                                                        <span
                                                                                            className="text-xs text-muted-foreground">
                                              {new Date(reply.createdAt).toLocaleDateString()}
                                            </span>
                                                                                    </div>

                                                                                    {/* Edit/Delete Reply Actions */}
                                                                                    {isSignedIn && user?.id === reply.userId && (
                                                                                        <div
                                                                                            className="flex gap-1 flex-shrink-0">
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() => {
                                                                                                    setEditingComment(reply._id);
                                                                                                    setEditCommentContent(reply.content);
                                                                                                }}
                                                                                                className="h-5 w-5 p-0"
                                                                                            >
                                                                                                <Edit
                                                                                                    className="h-2.5 w-2.5"/>
                                                                                            </Button>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() => handleDeleteReply(comment._id, reply._id)}
                                                                                                className="h-5 w-5 p-0"
                                                                                            >
                                                                                                <Trash2
                                                                                                    className="h-2.5 w-2.5"/>
                                                                                            </Button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>

                                                                                {/* Reply Content */}
                                                                                {editingComment === reply._id ? (
                                                                                    <div className="space-y-2">
                                                                                        <Textarea
                                                                                            value={editCommentContent}
                                                                                            onChange={(e) => setEditCommentContent(e.target.value)}
                                                                                            placeholder="Edit your reply..."
                                                                                            rows={2}
                                                                                            className="text-sm resize-none"
                                                                                        />
                                                                                        <div
                                                                                            className="flex justify-end gap-2">
                                                                                            <Button
                                                                                                onClick={() => setEditingComment(null)}
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                className="px-2 text-xs"
                                                                                            >
                                                                                                Cancel
                                                                                            </Button>
                                                                                            <Button
                                                                                                onClick={() => handleEditReply(comment._id, reply._id)}
                                                                                                disabled={!editCommentContent.trim()}
                                                                                                size="sm"
                                                                                                className="px-2 text-xs"
                                                                                            >
                                                                                                Save
                                                                                            </Button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <>
                                                                                        <p className="text-xs leading-relaxed">{reply.content}</p>

                                                                                        {/* Reply to Reply Button */}
                                                                                        {isSignedIn && (
                                                                                            <div
                                                                                                className="flex items-center gap-2 mt-1">
                                                                                                <Button
                                                                                                    variant="ghost"
                                                                                                    size="sm"
                                                                                                    onClick={() => {
                                                                                                        const replyKey = `${comment._id}-${reply._id}`;
                                                                                                        setShowReplyForm(prev => ({
                                                                                                            ...prev,
                                                                                                            [replyKey]: !prev[replyKey]
                                                                                                        }));
                                                                                                        // Pre-fill with @username
                                                                                                        setReplyContent(prev => ({
                                                                                                            ...prev,
                                                                                                            [replyKey]: `@${reply.username} `
                                                                                                        }));
                                                                                                    }}
                                                                                                    className="text-xs text-muted-foreground hover:text-primary h-5 px-1"
                                                                                                >
                                                                                                    Reply
                                                                                                </Button>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Reply to Reply Form */}
                                                                                        {showReplyForm[`${comment._id}-${reply._id}`] && isSignedIn && (
                                                                                            <div
                                                                                                className="mt-2 space-y-2">
                                                                                                <Textarea
                                                                                                    value={replyContent[`${comment._id}-${reply._id}`] || ''}
                                                                                                    onChange={(e) => setReplyContent(prev => ({
                                                                                                        ...prev,
                                                                                                        [`${comment._id}-${reply._id}`]: e.target.value
                                                                                                    }))}
                                                                                                    placeholder={`Reply to @${reply.username}...`}
                                                                                                    rows={2}
                                                                                                    className="text-sm resize-none"
                                                                                                />
                                                                                                <div
                                                                                                    className="flex justify-end gap-2">
                                                                                                    <Button
                                                                                                        onClick={() => setShowReplyForm(prev => ({
                                                                                                            ...prev,
                                                                                                            [`${comment._id}-${reply._id}`]: false
                                                                                                        }))}
                                                                                                        variant="outline"
                                                                                                        size="sm"
                                                                                                        className="px-2 text-xs"
                                                                                                    >
                                                                                                        Cancel
                                                                                                    </Button>
                                                                                                    <Button
                                                                                                        onClick={() => {
                                                                                                            const replyKey = `${comment._id}-${reply._id}`;
                                                                                                            const content = replyContent[replyKey]?.trim();
                                                                                                            if (content) {
                                                                                                                handleAddReply(comment._id, content);
                                                                                                                setReplyContent(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [replyKey]: ''
                                                                                                                }));
                                                                                                                setShowReplyForm(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [replyKey]: false
                                                                                                                }));
                                                                                                            }
                                                                                                        }}
                                                                                                        disabled={!replyContent[`${comment._id}-${reply._id}`]?.trim()}
                                                                                                        size="sm"
                                                                                                        className="px-2 text-xs"
                                                                                                    >
                                                                                                        Reply
                                                                                                    </Button>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </AnimatedSection>
                    ))
                )}
            </div>
        </div>
    );
}
