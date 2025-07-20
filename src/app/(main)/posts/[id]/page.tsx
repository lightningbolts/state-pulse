"use client";

import React, { useEffect, useState, useCallback } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { PostCard } from "@/components/features/PostCard";
import { useToast } from "@/hooks/use-toast";
import { Post, Comment, Reply } from "@/types/media";
import { Bill } from "@/types/legislation";

// A simple deep copy utility for safe optimistic update rollbacks
const deepCopy = <T,>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
};

export default function PostPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  // --- UI State ---
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPostType, setEditPostType] = useState<'legislation' | 'bug_report'>('legislation');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [editSelectedBills, setEditSelectedBills] = useState<Bill[]>([]);
  const [editShowBillSearch, setEditShowBillSearch] = useState(false);

  const [commentContent, setCommentContent] = useState("");
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});
  const [showReplyForm, setShowReplyForm] = useState<Record<string, boolean>>({});
  const [showReplies, setShowReplies] = useState<Record<string, boolean>>({});
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [editingReply, setEditingReply] = useState<{ commentId: string; replyId: string } | null>(null);
  const [editReplyContent, setEditReplyContent] = useState("");

  const fetchPost = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${id}`);
      if (!res.ok) throw new Error("Post not found");
      const data = await res.json();
      setPost(data.post);
    } catch (error) {
      console.error("Failed to fetch post:", error);
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  // --- CRUD Handlers ---

  const startEditPost = (postToEdit: Post) => {
    setEditingPostId(postToEdit._id);
    setEditTitle(postToEdit.title);
    setEditContent(postToEdit.content);
    setEditPostType(postToEdit.type);
    setEditTags(postToEdit.tags || []);
    setEditSelectedBills(postToEdit.linkedBills || []);
    setCurrentTag('');
  };

  const handleCancelEditPost = () => {
    setEditingPostId(null);
  };

  const handleSavePost = async (postId: string) => {
    if (!post || !editTitle.trim() || !editContent.trim()) return;

    const originalPost = deepCopy(post);
    const updatedPost = {
      ...post,
      title: editTitle,
      content: editContent,
      type: editPostType,
      tags: editTags,
      linkedBills: editPostType === 'legislation' ? editSelectedBills : [],
    };

    // Optimistic update
    setPost(updatedPost);
    setEditingPostId(null);

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          type: editPostType,
          tags: editTags,
          linkedBills: editPostType === 'legislation' ? editSelectedBills.map(b => b.id) : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save post');
      }

      toast({
        title: 'Success!',
        description: 'Your post has been updated.',
      });
    } catch (error) {
      console.error('Error updating post:', error);
      setPost(originalPost); // Revert on failure
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not save your changes. Please try again.',
      });
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !editTags.includes(currentTag.trim())) {
      setEditTags([...editTags, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditTags(editTags.filter(tag => tag !== tagToRemove));
  };

  const handleBillSelect = (bill: Bill) => {
    setEditSelectedBills(prev => {
      const exists = prev.find(b => b.id === bill.id);
      if (exists) {
        return prev.filter(b => b.id !== bill.id);
      } else {
        return [...prev, bill];
      }
    });
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete post on server.");
      toast({ title: "Success", description: "Post deleted." });
      router.push("/posts");
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete post. Please try again." });
    }
  };

  const handleLikePost = async (postId: string) => {
    if (!isSignedIn || !user || !post) {
      return toast({ variant: "destructive", title: "Authentication Error", description: "You must be signed in to like a post." });
    }

    const originalPost = deepCopy(post);
    const isLiked = post.likes.includes(user.id);
    const newLikes = isLiked
        ? post.likes.filter((likeId) => likeId !== user.id)
        : [...post.likes, user.id];

    setPost({ ...post, likes: newLikes });

    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to update like status.");
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Could not update like. Please try again." });
    }
  };

  const handleAddComment = async (postId: string) => {
    if (!isSignedIn || !user || !post || !commentContent.trim()) return;

    const originalPost = deepCopy(post);
    const tempId = `temp-comment-${Date.now()}`;
    const newComment: Comment = {
      _id: tempId,
      userId: user.id,
      username: user.username || "User",
      userImage: user.imageUrl,
      content: commentContent,
      createdAt: new Date(),
      replies: [],
    };

    setPost({ ...post, comments: [...post.comments, newComment] });
    setCommentContent("");

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.content }),
      });
      if (!res.ok) throw new Error("Failed to post comment.");
      const { comment: savedComment } = await res.json();
      setPost(currentPost => {
        if (!currentPost) return null;
        return {
          ...currentPost,
          comments: currentPost.comments.map(c => c._id === tempId ? savedComment : c)
        }
      });
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Failed to post comment. Please try again." });
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!post || !window.confirm("Are you sure you want to delete this comment?")) return;

    const originalPost = deepCopy(post);
    const updatedComments = post.comments.filter(c => c._id !== commentId);
    setPost({ ...post, comments: updatedComments });

    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete comment.");
      toast({ title: "Success", description: "Comment deleted." });
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete comment. Please try again." });
    }
  };

  const handleEditComment = async (postId: string, commentId: string) => {
    if (!post || !editCommentContent.trim()) return;

    const originalPost = deepCopy(post);
    const updatedComments = post.comments.map(c =>
        c._id === commentId ? { ...c, content: editCommentContent } : c
    );
    setPost({ ...post, comments: updatedComments });
    setEditingComment(null);
    setEditCommentContent("");

    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentContent }),
      });
      if (!res.ok) throw new Error("Failed to update comment.");
      toast({ title: "Success", description: "Comment updated." });
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Failed to update comment. Please try again." });
    }
  };

  const handleAddReply = async (commentId: string, customContent?: string) => {
    const content = (customContent || replyContent[commentId])?.trim();
    if (!isSignedIn || !user || !post || !content) return;

    const originalPost = deepCopy(post);
    const tempId = `temp-reply-${Date.now()}`;
    const newReply: Reply = {
      _id: tempId,
      userId: user.id,
      username: user.username || "User",
      userImage: user.imageUrl,
      content: content,
      createdAt: new Date(),
    };

    const updatedComments = post.comments.map(c => {
      if (c._id === commentId) {
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    });

    setPost({ ...post, comments: updatedComments });

    if (!customContent) {
      setReplyContent(prev => ({ ...prev, [commentId]: "" }));
      setShowReplyForm(prev => ({ ...prev, [commentId]: false }));
    }

    try {
      const res = await fetch(`/api/comments/${commentId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to post reply.");
      const { reply: savedReply } = await res.json();
      setPost(currentPost => {
        if (!currentPost) return null;
        const finalComments = currentPost.comments.map(c => {
          if (c._id === commentId) {
            return { ...c, replies: c.replies.map(r => r._id === tempId ? savedReply : r) };
          }
          return c;
        });
        return { ...currentPost, comments: finalComments };
      });
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Failed to post reply. Please try again." });
    }
  };

  const handleDeleteReply = async (commentId: string, replyId: string) => {
    if (!post || !window.confirm("Are you sure you want to delete this reply?")) return;

    const originalPost = deepCopy(post);
    const updatedComments = post.comments.map(c => {
      if (c._id === commentId) {
        return { ...c, replies: c.replies.filter(r => r._id !== replyId) };
      }
      return c;
    });
    setPost({ ...post, comments: updatedComments });

    try {
      const res = await fetch(`/api/comments/${commentId}/replies/${replyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete reply.");
      toast({ title: "Success", description: "Reply deleted." });
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Failed to delete reply. Please try again." });
    }
  };

  const handleEditReply = async (commentId: string, replyId: string) => {
    if (!post || !editReplyContent.trim()) return;

    const originalPost = deepCopy(post);
    const updatedComments = post.comments.map(c => {
      if (c._id === commentId) {
        const updatedReplies = c.replies.map(r =>
            r._id === replyId ? { ...r, content: editReplyContent } : r
        );
        return { ...c, replies: updatedReplies };
      }
      return c;
    });

    setPost({ ...post, comments: updatedComments });
    setEditingReply(null);
    setEditReplyContent("");

    try {
      const res = await fetch(`/api/comments/${commentId}/replies/${replyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editReplyContent }),
      });
      if (!res.ok) throw new Error("Failed to update reply.");
      toast({ title: "Success", description: "Reply updated." });
    } catch (error) {
      setPost(originalPost);
      toast({ variant: "destructive", title: "Error", description: "Failed to update reply. Please try again." });
    }
  };


  if (loading) return <div className="py-8 text-center">Loading post...</div>;
  if (!post) return notFound();

  return (
      <div className="flex justify-center py-8 px-2">
        <div className="w-full max-w-3xl">
          <PostCard
              post={post}
              user={user ? { id: user.id } : undefined}
              isSignedIn={!!isSignedIn}
              router={router}
              // Post Edit Actions
              editingPostId={editingPostId}
              startEditPost={startEditPost}
              handleCancelEditPost={handleCancelEditPost}
              handleSavePost={handleSavePost}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editContent={editContent}
              setEditContent={setEditContent}
              editPostType={editPostType}
              setEditPostType={setEditPostType}
              editTags={editTags}
              currentTag={currentTag}
              setCurrentTag={setCurrentTag}
              addTag={addTag}
              removeTag={removeTag}
              editSelectedBills={editSelectedBills}
              handleBillSelect={handleBillSelect}
              editShowBillSearch={editShowBillSearch}
              setEditShowBillSearch={setEditShowBillSearch}
              handleDeletePost={handleDeletePost}
              handleLikePost={handleLikePost}
              showComments={{ [post._id]: true }}
              setShowComments={() => {}}
              commentContent={{ [post._id]: commentContent }}
              setCommentContent={(updater) => {
                const newValue = typeof updater === 'function' ? updater({ [post._id]: commentContent }) : updater;
                setCommentContent(newValue[post._id] || "");
              }}
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
              editingReply={editingReply}
              setEditingReply={setEditingReply}
              editReplyContent={editReplyContent}
              setEditReplyContent={setEditReplyContent}
              handleEditReply={handleEditReply}
              handleDeleteReply={handleDeleteReply}
          />
        </div>
      </div>
  );
}