"use client"

import React from "react";
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { PostCard } from "@/components/features/PostCard";

interface Post {
  _id: string;
  userId: string;
  username: string;
  userImage?: string;
  type: "legislation" | "bug_report";
  title: string;
  content: string;
  linkedBills?: any[];
  tags: string[];
  likes: string[];
  comments: any[];
  createdAt: string;
  updatedAt: string;
}

export default function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(true);
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [likes, setLikes] = useState<string[]>([]);
  const [replyContent, setReplyContent] = useState<{ [key: string]: string }>({});
  const [showReplyForm, setShowReplyForm] = useState<{ [key: string]: boolean }>({});
  const [editingPost, setEditingPost] = useState(false);
  const [editPostTitle, setEditPostTitle] = useState("");
  const [editPostContent, setEditPostContent] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editReplyContent, setEditReplyContent] = useState("");

  useEffect(() => {
    async function fetchPost() {
      setLoading(true);
      const res = await fetch(`/api/posts/${unwrappedParams.id}`);
      if (res.ok) {
        const data = await res.json();
        setPost(data.post);
        setLikes(data.post.likes || []);
      }
      setLoading(false);
    }
    fetchPost();
  }, [unwrappedParams.id]);

  async function handleLike() {
    if (!isSignedIn || !post) return;
    await fetch(`/api/posts/${post._id}/like`, { method: "POST" });
    setLikes((prev) =>
      prev.includes(user?.id || "")
        ? prev.filter((id) => id !== user?.id)
        : [...prev, user?.id || ""]
    );
  }

  async function handleReply(parentId: string, content: string, isSubReply = false) {
    if (!isSignedIn || !content.trim()) return;
    let url = isSubReply ? `/api/comments/${parentId}/replies` : `/api/posts/${post?._id}/comments`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content })
    });
    setReplyContent((prev) => ({ ...prev, [parentId]: "" }));
    setShowReplyForm((prev) => ({ ...prev, [parentId]: false }));
    // Refresh post
    const res = await fetch(`/api/posts/${unwrappedParams.id}`);
    if (res.ok) {
      const data = await res.json();
      setPost(data.post);
    }
  }

  // Edit post handlers
  function startEditPost() {
    setEditingPost(true);
    setEditPostTitle(post?.title || "");
    setEditPostContent(post?.content || "");
  }
  async function handleUpdatePost() {
    if (!post) return;
    await fetch(`/api/posts/${post._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editPostTitle, content: editPostContent })
    });
    setEditingPost(false);
    const res = await fetch(`/api/posts/${unwrappedParams.id}`);
    if (res.ok) {
      const data = await res.json();
      setPost(data.post);
    }
  }
  async function handleDeletePost() {
    if (!post) return;
    if (!confirm("Are you sure you want to delete this post?")) return;
    await fetch(`/api/posts/${post._id}`, { method: "DELETE" });
    router.push("/posts");
  }

  // Edit comment handlers
  function startEditComment(commentId: string, content: string) {
    setEditingComment(commentId);
    setEditCommentContent(content);
  }
  async function handleUpdateComment(commentId: string) {
    await fetch(`/api/posts/${post?._id}/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editCommentContent })
    });
    setEditingComment(null);
    setEditCommentContent("");
    const res = await fetch(`/api/posts/${unwrappedParams.id}`);
    if (res.ok) {
      const data = await res.json();
      setPost(data.post);
    }
  }
  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    await fetch(`/api/posts/${post?._id}/comments/${commentId}`, { method: "DELETE" });
    const res = await fetch(`/api/posts/${unwrappedParams.id}`);
    if (res.ok) {
      const data = await res.json();
      setPost(data.post);
    }
  }

  // Edit reply handlers
  function startEditReply(replyId: string, content: string) {
    setEditingReply(replyId);
    setEditReplyContent(content);
  }
  async function handleUpdateReply(commentId: string, replyId: string) {
    await fetch(`/api/comments/${commentId}/replies/${replyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editReplyContent })
    });
    setEditingReply(null);
    setEditReplyContent("");
    const res = await fetch(`/api/posts/${unwrappedParams.id}`);
    if (res.ok) {
      const data = await res.json();
      setPost(data.post);
    }
  }
  async function handleDeleteReply(commentId: string, replyId: string) {
    if (!confirm("Delete this reply?")) return;
    await fetch(`/api/comments/${commentId}/replies/${replyId}`, { method: "DELETE" });
    const res = await fetch(`/api/posts/${unwrappedParams.id}`);
    if (res.ok) {
      const data = await res.json();
      setPost(data.post);
    }
  }

  if (loading) return <div className="py-8 text-center">Loading...</div>;
  if (!post) return notFound();

  return (
    <div className="flex justify-center py-8 px-2">
      <PostCard
        post={post}
        user={user}
        isSignedIn={isSignedIn}
        router={router}
        startEditPost={startEditPost}
        handleDeletePost={handleDeletePost}
        handleLikePost={handleLike}
        showComments={{ [post._id]: showComments }}
        setShowComments={v => setShowComments(v[post._id])}
        commentContent={replyContent}
        setCommentContent={setReplyContent}
        handleAddComment={(id) => handleReply(id, replyContent[id] || "")}
        editingComment={editingComment}
        setEditingComment={setEditingComment}
        editCommentContent={editCommentContent}
        setEditCommentContent={setEditCommentContent}
        handleEditComment={handleUpdateComment}
        handleDeleteComment={handleDeleteComment}
        showReplyForm={showReplyForm}
        setShowReplyForm={setShowReplyForm}
        replyContent={replyContent}
        setReplyContent={setReplyContent}
        handleAddReply={(id) => handleReply(id, replyContent[id] || "", true)}
        showReplies={{}}
        setShowReplies={() => {}}
        handleDeleteReply={handleDeleteReply}
        handleEditReply={handleUpdateReply}
      />
    </div>
  );
}
