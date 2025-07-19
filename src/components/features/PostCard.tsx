import React from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, AlertTriangle, Edit, Trash2, Heart, MessageCircle } from "lucide-react";
import { SelectedBills } from "./SelectedBills";
import { Textarea } from "@/components/ui/textarea";

// Type definitions for props and related objects
interface Reply {
    _id: string;
    userId: string;
    username: string;
    userImage?: string;
    content: string;
    createdAt: string | number | Date;
}

interface Comment {
    _id: string;
    userId: string;
    username: string;
    userImage?: string;
    content: string;
    createdAt: string | number | Date;
    replies: Reply[];
}

interface Post {
    _id: string;
    userId: string;
    username: string;
    userImage?: string;
    title: string;
    content: string;
    createdAt: string | number | Date;
    type: string;
    tags: string[];
    likes: string[];
    comments: Comment[];
    linkedBills?: any[];
}

interface User {
    id: string;
}

interface PostCardProps {
    post: Post;
    user?: User;
    isSignedIn: boolean;
    router: any;
    startEditPost: (post: Post) => void;
    handleDeletePost: (postId: string) => void;
    handleLikePost: (postId: string) => void;
    showComments: Record<string, boolean>;
    setShowComments: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    commentContent: Record<string, string>;
    setCommentContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleAddComment: (postId: string) => void;
    editingComment: string | null;
    setEditingComment: React.Dispatch<React.SetStateAction<string | null>>;
    editCommentContent: string;
    setEditCommentContent: React.Dispatch<React.SetStateAction<string>>;
    handleEditComment: (postId: string, commentId: string) => void;
    handleDeleteComment: (postId: string, commentId: string) => void;
    showReplyForm: Record<string, boolean>;
    setShowReplyForm: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    replyContent: Record<string, string>;
    setReplyContent: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleAddReply: (commentId: string, content?: string) => void;
    showReplies: Record<string, boolean>;
    setShowReplies: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    handleDeleteReply: (commentId: string, replyId: string) => void;
    handleEditReply: (commentId: string, replyId: string) => void;
}

export function PostCard({
                             post,
                             user,
                             isSignedIn,
                             router,
                             startEditPost,
                             handleDeletePost,
                             handleLikePost,
                             showComments,
                             setShowComments,
                             commentContent,
                             setCommentContent,
                             handleAddComment,
                             editingComment,
                             setEditingComment,
                             editCommentContent,
                             setEditCommentContent,
                             handleEditComment,
                             handleDeleteComment,
                             showReplyForm,
                             setShowReplyForm,
                             replyContent,
                             setReplyContent,
                             handleAddReply,
                             showReplies,
                             setShowReplies,
                             handleDeleteReply,
                             handleEditReply
                         }: PostCardProps) {
    return (
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
                                    className="text-xs px-2 py-0.5"
                                >
                                    {post.type === 'legislation' ? (
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
                            </div>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                                {new Date(post.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                    </div>
                    {isSignedIn && user?.id === post.userId && (
                        <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEditPost(post)}
                                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                            >
                                <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePost(post._id)}
                                className="h-8 w-8 sm:h-9 sm:w-9 p-0"
                            >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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
                {post.linkedBills && post.linkedBills.length > 0 && (
                    <div className="mt-3 sm:mt-4">
                        <SelectedBills
                            selectedBills={post.linkedBills}
                            onRemoveBill={() => {}}
                            onClearAll={() => {}}
                            title="Referenced Bills"
                            description="Bills discussed in this post"
                            readOnly={true}
                        />
                    </div>
                )}
                {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                        {post.tags.map((tag: string) => (
                            <Badge key={tag} variant="outline" className="text-xs px-2 py-0.5">
                                {tag}
                            </Badge>
                        ))}
                    </div>
                )}
                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLikePost(post._id)}
                            className={`flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 ${isSignedIn && post.likes.includes(user?.id || '') ? 'text-red-500' : ''}`}
                        >
                            <Heart className={`h-4 w-4 ${isSignedIn && post.likes.includes(user?.id || '') ? 'fill-red-500' : ''}`} />
                            <span className="text-sm">{post.likes.length}</span>
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowComments((prev: Record<string, boolean>) => ({ ...prev, [post._id]: !prev[post._id] }))}
                            className="flex items-center gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3"
                        >
                            <MessageCircle className="h-4 w-4" />
                            <span className="text-sm">{post.comments.length}</span>
                        </Button>
                    </div>
                </div>
                {showComments[post._id] && (
                    <div className="space-y-3 sm:space-y-4 pt-3 sm:pt-4 border-t">
                        {isSignedIn && (
                            <div className="space-y-2">
                                <Textarea
                                    value={commentContent[post._id] || ''}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentContent((prev: Record<string, string>) => ({ ...prev, [post._id]: e.target.value }))}
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
                        <div className="space-y-2 sm:space-y-3">
                            {post.comments.map((comment: Comment) => (
                                <div key={comment._id} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-muted rounded-lg">
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
                                                        <Edit className="h-3 w-3" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteComment(post._id, comment._id)}
                                                        className="h-6 w-6 sm:h-7 sm:w-7 p-0"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
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
                                                {isSignedIn && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setShowReplyForm((prev: Record<string, boolean>) => ({ ...prev, [comment._id]: !prev[comment._id] }))}
                                                            className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                                                        >
                                                            Reply
                                                        </Button>
                                                        {comment.replies && comment.replies.length > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setShowReplies((prev: Record<string, boolean>) => ({ ...prev, [comment._id]: !prev[comment._id] }))}
                                                                className="text-xs text-muted-foreground hover:text-primary h-6 px-2"
                                                            >
                                                                {showReplies[comment._id] ? 'Hide' : 'View'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                {showReplyForm[comment._id] && isSignedIn && (
                                                    <div className="mt-3 space-y-2">
                                                        <Textarea
                                                            value={replyContent[comment._id] || ''}
                                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent((prev: Record<string, string>) => ({ ...prev, [comment._id]: e.target.value }))}
                                                            placeholder="Write a reply..."
                                                            rows={2}
                                                            className="text-sm resize-none"
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <Button
                                                                onClick={() => setShowReplyForm((prev: Record<string, boolean>) => ({ ...prev, [comment._id]: false }))}
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
                                        {showReplies[comment._id] && comment.replies && comment.replies.length > 0 && (
                                            <div className="mt-3 ml-4 space-y-2 border-l-2 border-muted pl-4">
                                                {comment.replies.map((reply: Reply) => (
                                                    <div key={reply._id} className="flex gap-2 sm:gap-3 p-2 sm:p-3 bg-background rounded-lg border">
                                                        {reply.userImage && (
                                                            <img
                                                                src={reply.userImage}
                                                                alt={reply.username}
                                                                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex-shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                                                                onClick={() => router.push(`/users/${reply.userId}`)}
                                                            />
                                                        )}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span
                                      className="font-medium text-xs cursor-pointer hover:text-primary transition-colors"
                                      onClick={() => router.push(`/users/${reply.userId}`)}
                                  >
                                    {reply.username}
                                  </span>
                                                                    <span className="text-xs text-muted-foreground">
                                    {new Date(reply.createdAt).toLocaleDateString()}
                                  </span>
                                                                </div>
                                                                {isSignedIn && user?.id === reply.userId && (
                                                                    <div className="flex gap-1 flex-shrink-0">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                setEditingComment(reply._id);
                                                                                setEditCommentContent(reply.content);
                                                                            }}
                                                                            className="h-5 w-5 p-0"
                                                                        >
                                                                            <Edit className="h-2.5 w-2.5" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteReply(comment._id, reply._id)}
                                                                            className="h-5 w-5 p-0"
                                                                        >
                                                                            <Trash2 className="h-2.5 w-2.5" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {editingComment === reply._id ? (
                                                                <div className="space-y-2">
                                                                    <Textarea
                                                                        value={editCommentContent}
                                                                        onChange={(e) => setEditCommentContent(e.target.value)}
                                                                        placeholder="Edit your reply..."
                                                                        rows={2}
                                                                        className="text-sm resize-none"
                                                                    />
                                                                    <div className="flex justify-end gap-2">
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
                                                                    {isSignedIn && (
                                                                        <div className="flex items-center gap-2 mt-1">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    const replyKey = `${comment._id}-${reply._id}`;
                                                                                    setShowReplyForm((prev: Record<string, boolean>) => ({ ...prev, [replyKey]: !prev[replyKey] }));
                                                                                    setReplyContent((prev: Record<string, string>) => ({ ...prev, [replyKey]: `@${reply.username} ` }));
                                                                                }}
                                                                                className="text-xs text-muted-foreground hover:text-primary h-5 px-1"
                                                                            >
                                                                                Reply
                                                                            </Button>
                                                                        </div>
                                                                    )}
                                                                    {showReplyForm[`${comment._id}-${reply._id}`] && isSignedIn && (
                                                                        <div className="mt-2 space-y-2">
                                                                            <Textarea
                                                                                value={replyContent[`${comment._id}-${reply._id}`] || ''}
                                                                                onChange={(e) => setReplyContent((prev: Record<string, string>) => ({ ...prev, [`${comment._id}-${reply._id}`]: e.target.value }))}
                                                                                placeholder={`Reply to @${reply.username}...`}
                                                                                rows={2}
                                                                                className="text-sm resize-none"
                                                                            />
                                                                            <div className="flex justify-end gap-2">
                                                                                <Button
                                                                                    onClick={() => setShowReplyForm((prev: Record<string, boolean>) => ({ ...prev, [`${comment._id}-${reply._id}`]: false }))}
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
                                                                                            setReplyContent((prev: Record<string, string>) => ({ ...prev, [replyKey]: '' }));
                                                                                            setShowReplyForm((prev: Record<string, boolean>) => ({ ...prev, [replyKey]: false }));
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
    );
}