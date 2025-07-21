import React, { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle, Edit, Trash2, Heart, MessageCircle, X } from "lucide-react";
import { SelectedBills } from "./SelectedBills";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Post, Comment, Reply } from "@/types/media";
import { Bill } from "@/types/legislation";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { BillSearch } from "./BillSearch";


interface PostCardProps {
    post: Post;
    onPostDeleted?: () => void; // callback for parent to refresh posts if deleted
}


export function PostCard({ post, onPostDeleted }: PostCardProps) {
    const { user, isSignedIn } = useUser();
    const router = useRouter();
    const { toast } = useToast();

    // Unified local post state
    const [postState, setPostState] = useState<Post>(post);

    // Local state for editing post
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(post.title);
    const [editContent, setEditContent] = useState(post.content);
    const [editPostType, setEditPostType] = useState<'legislation' | 'bug_report'>(post.type);
    const [editTags, setEditTags] = useState<string[]>(post.tags || []);
    const [currentTag, setCurrentTag] = useState('');
    const [editSelectedBills, setEditSelectedBills] = useState<Bill[]>(post.linkedBills || []);
    const [editShowBillSearch, setEditShowBillSearch] = useState(false);

    // Local state for comments and replies
    const [showComments, setShowComments] = useState(false);
    const [commentContent, setCommentContent] = useState('');
    const [editingComment, setEditingComment] = useState<string | null>(null);
    const [editCommentContent, setEditCommentContent] = useState('');
    const [showReplyForm, setShowReplyForm] = useState<Record<string, boolean>>({});
    const [replyContent, setReplyContent] = useState<Record<string, string>>({});
    const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
    const [editingReply, setEditingReply] = useState<{ commentId: string; replyId: string } | null>(null);
    const [editReplyContent, setEditReplyContent] = useState('');

    // Only reset local state if the post ID changes (e.g., navigating to a different post)
    useEffect(() => {
        setPostState(post);
        setEditTitle(post.title);
        setEditContent(post.content);
        setEditPostType(post.type);
        setEditTags(post.tags || []);
        setEditSelectedBills(post.linkedBills || []);
    }, [post._id]);

    // Helper: refresh post data from API (for comments/likes)
    const refreshPost = async () => {
        try {
            const response = await fetch(`/api/posts/${postState._id}`);
            if (response.ok) {
                const data = await response.json();
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {
            // ignore
        }
    };

    // Post actions
    const handleSavePost = async () => {
        if (!isSignedIn) return;
        try {
            const response = await fetch(`/api/posts/${postState._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editTitle.trim(),
                    content: editContent.trim(),
                    type: editPostType,
                    linkedBills: editPostType === 'legislation' ? editSelectedBills : undefined,
                    tags: editTags
                })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('handleSavePost API response:', data.post);
                setIsEditing(false);
                if (data.post && typeof data.post === 'object') setPostState(data.post);
                setEditTitle(data.post?.title ?? editTitle);
                setEditContent(data.post?.content ?? editContent);
                setEditPostType(data.post?.type ?? editPostType);
                setEditTags(data.post?.tags || editTags);
                setEditSelectedBills(data.post?.linkedBills || editSelectedBills);
            }
        } catch (error) {
            // ignore
        }
    };

    const handleDeletePost = async () => {
        if (!isSignedIn || !confirm('Are you sure you want to delete this post?')) return;
        try {
            const response = await fetch(`/api/posts/${post._id}`, { method: 'DELETE' });
            if (response.ok && onPostDeleted) onPostDeleted();
        } catch (error) {}
    };

    const handleLikePost = async () => {
        if (!isSignedIn) return;
        try {
            const response = await fetch(`/api/posts/${postState._id}/like`, { method: 'POST' });
            if (response.ok) {
                const data = await response.json();
                console.log('handleLikePost API response:', data.post);
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };

    // Comment actions
    const handleAddComment = async () => {
        if (!isSignedIn || !commentContent.trim()) return;
        try {
            const response = await fetch(`/api/posts/${postState._id}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: commentContent.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('handleAddComment API response:', data.post);
                setCommentContent('');
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };
    const handleEditComment = async (commentId: string) => {
        if (!isSignedIn || !editCommentContent.trim()) return;
        try {
            const response = await fetch(`/api/posts/${postState._id}/comments/${commentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editCommentContent.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('handleEditComment API response:', data.post);
                setEditingComment(null);
                setEditCommentContent('');
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };
    const handleDeleteComment = async (commentId: string) => {
        if (!isSignedIn || !confirm('Are you sure you want to delete this comment?')) return;
        try {
            const response = await fetch(`/api/posts/${postState._id}/comments/${commentId}`, { method: 'DELETE' });
            if (response.ok) {
                const data = await response.json();
                console.log('handleDeleteComment API response:', data.post);
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };

    // Reply actions
    const handleAddReply = async (commentId: string, customContent?: string) => {
        const content = customContent || replyContent[commentId];
        if (!isSignedIn || !content?.trim()) return;
        try {
            const response = await fetch(`/api/comments/${commentId}/replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('handleAddReply API response:', data.post);
                setReplyContent(prev => ({ ...prev, [commentId]: '' }));
                setShowReplies(prev => ({ ...prev, [commentId]: true }));
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };
    const handleEditReply = async (commentId: string, replyId: string) => {
        if (!isSignedIn || !editReplyContent.trim()) return;
        try {
            const response = await fetch(`/api/comments/${commentId}/replies/${replyId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: editReplyContent.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                console.log('handleEditReply API response:', data.post);
                setEditingReply(null);
                setEditReplyContent('');
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };
    const handleDeleteReply = async (commentId: string, replyId: string) => {
        if (!isSignedIn || !confirm('Are you sure you want to delete this reply?')) return;
        try {
            const response = await fetch(`/api/comments/${commentId}/replies/${replyId}`, { method: 'DELETE' });
            if (response.ok) {
                const data = await response.json();
                console.log('handleDeleteReply API response:', data.post);
                if (data.post && typeof data.post === 'object') setPostState(data.post);
            }
        } catch (error) {}
    };

    // Tag actions
    const addTag = () => {
        if (currentTag.trim() && !editTags.includes(currentTag.trim())) {
            setEditTags([...editTags, currentTag.trim()]);
            setCurrentTag('');
        }
    };
    const removeTag = (tagToRemove: string) => {
        setEditTags(editTags.filter(tag => tag !== tagToRemove));
    };

    // Bill actions
    const handleBillSelect = (bill: Bill) => {
        if (!bill || !bill.id) return;
        setEditSelectedBills(prev => {
            const filteredPrev = prev.filter(b => b && b.id);
            const exists = filteredPrev.find(b => b.id === bill.id);
            if (exists) {
                return filteredPrev.filter(b => b.id !== bill.id);
            } else {
                return [...filteredPrev, bill];
            }
        });
    };
    const isEditingPost = isEditing;

    const arraysAreEqual = (a: any[], b: any[]) => {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
    };

    const billsAreEqual = (a: Bill[], b: Bill[]) => {
        if (a.length !== b.length) return false;
        const aIds = a.filter(Boolean).map(bill => bill.id).sort();
        const bIds = b.filter(Boolean).map(bill => bill.id).sort();
        return arraysAreEqual(aIds, bIds);
    };

    const isPostUnchanged =
        !!postState &&
        typeof postState === 'object' &&
        postState.title === editTitle &&
        postState.content === editContent &&
        postState.type === editPostType &&
        arraysAreEqual(postState.tags || [], editTags) &&
        billsAreEqual(postState.linkedBills || [], editSelectedBills);

    // Add ref and effect for reply-to-reply textarea
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        // Find the currently open reply-to-reply form
        const openKey = Object.keys(showReplyForm).find(
            key => showReplyForm[key]
        );
        if (openKey && replyTextareaRef.current) {
            const val = replyContent[openKey] || '';
            replyTextareaRef.current.focus();
            replyTextareaRef.current.setSelectionRange(val.length, val.length);
        }
    }, [showReplyForm, replyContent]);

    console.log('PostCard render, postState:', postState);
    if (!postState || typeof postState !== 'object' || !postState.title) {
        return null;
    }
    return (
        <Card className="mx-0 sm:mx-0">
            <CardHeader className="pb-3 sm:pb-4">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        {postState.userImage && (
                            <img
                                src={postState.userImage}
                                alt={postState.username}
                                className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex-shrink-0 cursor-default select-none pointer-events-none"
                                draggable={false}
                                onContextMenu={e => e.preventDefault()}
                                onMouseDown={e => e.preventDefault()}
                                onDragStart={e => e.preventDefault()}
                                onCopy={e => e.preventDefault()}
                                onPaste={e => e.preventDefault()}
                                onCut={e => e.preventDefault()}
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span
                                    className="font-medium text-sm sm:text-base truncate cursor-pointer hover:text-primary transition-colors"
                                    onClick={() => router.push(`/users/${postState.userId}`)}
                                >
                                  {postState.username}
                                </span>
                                {!isEditingPost && (
                                    <Badge
                                        variant={postState.type === 'legislation' ? 'default' : 'destructive'}
                                        className="text-xs px-2 py-0.5"
                                    >
                                        {postState.type === 'legislation' ? (
                                            <>
                                                <FileText className="h-3 w-3 mr-1" />
                                                <span className="hidden xs:inline">Legislation</span>
                                                <span className="xs:hidden">Bills</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                <span className="hidden xs:inline">Bug Report</span>
                                                <span className="xs:hidden">Bug</span>
                                            </>
                                        )}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                {new Date(postState.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    {isSignedIn && user?.id === post.userId && (
                        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                            {isEditing ? (
                                <>
                                    <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                                    <Button size="sm" onClick={handleSavePost} disabled={isPostUnchanged || !editTitle.trim() || !editContent.trim()}>Save</Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                                        <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={handleDeletePost} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                                        <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {isEditing ? (
                    <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-base sm:text-lg font-bold leading-tight mt-2"
                        placeholder="Post title"
                    />
                ) : (
                    <CardTitle className="text-base sm:text-lg leading-tight">
                        <Link href={`/posts/${postState._id}`} className="text-blue-600 hover:underline">
                            {postState.title}
                        </Link>
                    </CardTitle>
                )}
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6">
                {isEditingPost ? (
                    <div className="space-y-4">
                        <Tabs value={editPostType} onValueChange={(value) => setEditPostType(value as 'legislation' | 'bug_report')}>
                            <TabsList className="grid w-full grid-cols-2 h-10 sm:h-auto">
                                <TabsTrigger value="legislation" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                                    <FileText className="h-3 w-3 sm:h-4 sm:w-4"/>
                                    <span className="hidden xs:inline">Legislation</span>
                                    <span className="xs:hidden">Bills</span>
                                </TabsTrigger>
                                <TabsTrigger value="bug_report" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
                                    <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4"/>
                                    <span className="hidden xs:inline">Bug Report</span>
                                    <span className="xs:hidden">Bug</span>
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <Textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="text-sm sm:text-base leading-relaxed"
                            rows={8}
                            placeholder="Post content"
                        />
                        {editPostType === 'legislation' && (
                            <>
                                <SelectedBills
                                    selectedBills={editSelectedBills}
                                    onRemoveBill={(billId) => handleBillSelect(editSelectedBills.find(b => b.id === billId)!)}
                                    onClearAll={() => setEditSelectedBills([])}
                                    title="Linked Bills"
                                    description="Bills referenced in this post"
                                />
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">Link Related Bills</label>
                                        <Button variant="outline" size="sm" onClick={() => setEditShowBillSearch(!editShowBillSearch)} className="text-xs sm:text-sm px-2 sm:px-3">
                                            {editShowBillSearch ? 'Hide' : 'Show'} Search
                                        </Button>
                                    </div>
                                    {editShowBillSearch && (
                                        <div className="p-3 sm:p-4 bg-muted rounded-lg">
                                            <BillSearch selectedBills={editSelectedBills} onBillSelect={handleBillSelect} />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                        <div>
                            <label className="block text-sm font-medium mb-2">Tags</label>
                            <div className="flex gap-2 mb-2 flex-wrap sm:flex-nowrap">
                                <Input
                                    value={currentTag}
                                    onChange={(e) => setCurrentTag(e.target.value)}
                                    placeholder="Add a tag..."
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                    className="flex-1 text-sm sm:text-base"
                                />
                                <Button onClick={addTag} variant="outline" className="px-3 sm:px-4 whitespace-nowrap">
                                    Add
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-1 sm:gap-2">
                                {editTags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="flex items-center gap-1 text-xs px-2 py-1">
                                        <span className="truncate max-w-[100px] sm:max-w-none">{tag}</span>
                                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-transparent" onClick={() => removeTag(tag)}>
                                            <X className="h-3 w-3"/>
                                        </Button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{postState.content}</p>
                        {postState.type === 'legislation' && postState.linkedBills && postState.linkedBills.length > 0 && (
                            <div className="mt-3 sm:mt-4">
                                <SelectedBills selectedBills={postState.linkedBills as Bill[]} onRemoveBill={() => {}} onClearAll={() => {}} title="Referenced Bills" description="Bills discussed in this post" readOnly={true} />
                            </div>
                        )}
                        {postState.tags && postState.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 sm:gap-2">
                                {postState.tags.map((tag: string) => ( <Badge key={tag} variant="outline" className="text-xs px-2 py-0.5">{tag}</Badge> ))}
                            </div>
                        )}
                    </>
                )}

                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Button variant="ghost" size="sm" onClick={handleLikePost} className={`flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 ${isSignedIn && postState.likes && postState.likes.includes(user?.id || '') ? 'text-red-500' : ''}`}>
                            <Heart className={`h-4 w-4 ${isSignedIn && postState.likes && postState.likes.includes(user?.id || '') ? 'fill-red-500' : ''}`} />
                            <span className="text-sm">{postState.likes ? postState.likes.length : 0}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowComments((prev) => !prev)} className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3">
                            <MessageCircle className="h-4 w-4" />
                            <span className="text-sm">{postState.comments ? postState.comments.length : 0}</span>
                        </Button>
                    </div>
                </div>

                {showComments && (
                    <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
                        {isSignedIn && (
                            <div className="space-y-2">
                                <Textarea value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="Write a comment..." rows={2} className="text-sm resize-none" />
                                <div className="flex justify-end">
                                    <Button onClick={handleAddComment} disabled={!commentContent.trim()} size="sm" className="px-4 sm:px-6">Post</Button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-2 sm:space-y-3">
                            {(postState.comments || []).map((comment: Comment) => (
                                <div key={comment._id} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-muted rounded-lg">
                                    {comment.userImage && (
                                        <img
                                            src={comment.userImage}
                                            alt={comment.username}
                                            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex-shrink-0 mt-0.5 cursor-default select-none pointer-events-none"
                                            draggable={false}
                                            // ...removed userDrag property...
                                            onContextMenu={e => e.preventDefault()}
                                            onMouseDown={e => e.preventDefault()}
                                            onDragStart={e => e.preventDefault()}
                                            onCopy={e => e.preventDefault()}
                                            onPaste={e => e.preventDefault()}
                                            onCut={e => e.preventDefault()}
                                        />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="font-medium text-xs sm:text-sm cursor-pointer hover:text-primary transition-colors" onClick={() => router.push(`/users/${comment.userId}`)}>{comment.username}</span>
                                                <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            {isSignedIn && user?.id === comment.userId && (
                                                <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                                                    <Button variant="ghost" size="sm" onClick={() => { setEditingComment(comment._id); setEditCommentContent(comment.content); }} className="h-6 w-6 sm:h-7 sm:w-7 p-0"><Edit className="h-3 w-3" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteComment(comment._id)} className="h-6 w-6 sm:h-7 sm:w-7 p-0"><Trash2 className="h-3 w-3" /></Button>
                                                </div>
                                            )}
                                        </div>
                                        {editingComment === comment._id ? (
                                            <div className="space-y-2">
                                                <Textarea value={editCommentContent} onChange={(e) => setEditCommentContent(e.target.value)} placeholder="Edit your comment..." rows={2} className="text-sm resize-none" />
                                                <div className="flex justify-end gap-2">
                                                    <Button onClick={() => setEditingComment(null)} variant="outline" size="sm" className="px-3 sm:px-4">Cancel</Button>
                                                    <Button onClick={() => handleEditComment(comment._id)} disabled={!editCommentContent.trim()} size="sm" className="px-3 sm:px-4">Save</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-xs sm:text-sm leading-relaxed">{comment.content}</p>
                                                {isSignedIn && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Button variant="ghost" size="sm" onClick={() => setShowReplyForm((prev) => ({ ...prev, [comment._id]: !prev[comment._id] }))} className="text-xs text-muted-foreground hover:text-primary h-6 px-2">Reply</Button>
                                                        {comment.replies && comment.replies.length > 0 && (
                                                            <Button variant="ghost" size="sm" onClick={() => setShowReplies((prev) => ({ ...prev, [comment._id]: !prev[comment._id] }))} className="text-xs text-muted-foreground hover:text-primary h-6 px-2">
                                                                {showReplies[comment._id] ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                {showReplyForm[comment._id] && isSignedIn && (
                                                    <div className="mt-3 space-y-2">
                                                        <Textarea value={replyContent[comment._id] || ''} onChange={(e) => setReplyContent((prev) => ({ ...prev, [comment._id]: e.target.value }))} placeholder="Write a reply..." rows={2} className="text-sm resize-none" />
                                                        <div className="flex justify-end gap-2">
                                                            <Button onClick={() => setShowReplyForm((prev) => ({ ...prev, [comment._id]: false }))} variant="outline" size="sm" className="px-3 sm:px-4">Cancel</Button>
                                                            <Button onClick={() => handleAddReply(comment._id)} disabled={!replyContent[comment._id]?.trim()} size="sm" className="px-3 sm:px-4">Reply</Button>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {showReplies[comment._id] && comment.replies && comment.replies.length > 0 && (
                                            <div className="mt-3 ml-4 space-y-2 border-l-2 border-muted pl-4">
                                                {comment.replies.map((reply: Reply) => (
                                                    <div key={reply._id} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-lg border">
                                                        {reply.userImage && (
                                                            <img
                                                                src={reply.userImage}
                                                                alt={reply.username}
                                                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 mt-0.5 cursor-default select-none pointer-events-none"
                                                                draggable={false}
                                                                // ...removed userDrag property...
                                                                onContextMenu={e => e.preventDefault()}
                                                                onMouseDown={e => e.preventDefault()}
                                                                onDragStart={e => e.preventDefault()}
                                                                onCopy={e => e.preventDefault()}
                                                                onPaste={e => e.preventDefault()}
                                                                onCut={e => e.preventDefault()}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                    <span className="font-medium text-xs cursor-pointer hover:text-primary transition-colors" onClick={() => router.push(`/users/${reply.userId}`)}>{reply.username}</span>
                                                                    <span className="text-xs text-muted-foreground">{new Date(reply.createdAt).toLocaleDateString()}</span>
                                                                </div>
                                                                {isSignedIn && user?.id === reply.userId && (
                                                                    <div className="flex gap-1 flex-shrink-0">
                                                                        <Button variant="ghost" size="sm" onClick={() => { setEditingReply({ commentId: comment._id, replyId: reply._id }); setEditReplyContent(reply.content); }} className="h-5 w-5 p-0">
                                                                            <Edit className="h-2.5 w-2.5" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteReply(comment._id, reply._id)} className="h-5 w-5 p-0">
                                                                            <Trash2 className="h-2.5 w-2.5" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {editingReply?.replyId === reply._id ? (
                                                                <div className="space-y-2 mt-2">
                                                                    <Textarea
                                                                        value={editReplyContent}
                                                                        onChange={(e) => setEditReplyContent(e.target.value)}
                                                                        placeholder="Edit your reply..."
                                                                        rows={2}
                                                                        className="text-sm resize-none"
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button onClick={() => setEditingReply(null)} variant="outline" size="sm" className="px-2 text-xs h-7">
                                                                            Cancel
                                                                        </Button>
                                                                        <Button onClick={() => handleEditReply(comment._id, reply._id)} disabled={!editReplyContent.trim()} size="sm" className="px-2 text-xs h-7">
                                                                            Save
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="text-xs leading-relaxed" dangerouslySetInnerHTML={{ __html: reply.content.replace(/(@\w+)/g, '<strong class="text-primary">$&</strong>') }}></p>
                                                                    {isSignedIn && (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    const replyKey = `${comment._id}-${reply._id}`;
                                                                                    setShowReplyForm(prev => ({ ...prev, [replyKey]: !prev[replyKey] }));
                                                                                    setReplyContent(prev => ({ ...prev, [replyKey]: `@${reply.username} ` }));
                                                                                }}
                                                                                className="text-xs text-muted-foreground hover:text-primary h-5 px-1"
                                                                            >
                                                                                Reply
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                            {showReplyForm[`${comment._id}-${reply._id}`] && isSignedIn && (
                                                                <div className="mt-2 space-y-2">
                                                                    <Textarea
                                                                        ref={replyTextareaRef}
                                                                        value={replyContent[`${comment._id}-${reply._id}`] || ''}
                                                                        onChange={(e) => setReplyContent(prev => ({ ...prev, [`${comment._id}-${reply._id}`]: e.target.value }))}
                                                                        placeholder={`Reply to @${reply.username}...`}
                                                                        rows={2}
                                                                        className="text-sm resize-none"
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button
                                                                            onClick={() => setShowReplyForm(prev => ({ ...prev, [`${comment._id}-${reply._id}`]: false }))}
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="px-2 text-xs h-7"
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => {
                                                                                const replyKey = `${comment._id}-${reply._id}`;
                                                                                const content = replyContent[replyKey]?.trim();
                                                                                if (content) {
                                                                                    handleAddReply(comment._id, content);
                                                                                    setShowReplyForm(prev => ({ ...prev, [replyKey]: false }));
                                                                                }
                                                                            }}
                                                                            disabled={!replyContent[`${comment._id}-${reply._id}`]?.trim()}
                                                                            size="sm"
                                                                            className="px-2 text-xs h-7"
                                                                        >
                                                                            Reply
                                                                        </Button>
                                                                    </div>
                                                                </div>
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
    );
}