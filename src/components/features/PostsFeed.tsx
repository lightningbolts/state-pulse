"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  MessageSquare,
  AlertTriangle,
  FileText,
  Heart,
  MessageCircle,
  Share
} from "lucide-react";
import { BillSearch } from "./BillSearch";
import { SelectedBills } from "./SelectedBills";

interface Bill {
  id: string;
  identifier: string;
  title: string;
  subject: string[];
  classification: string[];
  from_organization?: {
    name: string;
  };
  latest_action_description?: string;
  latest_action_date?: string;
  abstract?: string;
}

interface Post {
  _id: string;
  userId: string;
  username: string;
  userImage?: string;
  type: 'legislation' | 'bug_report';
  title: string;
  content: string;
  linkedBills?: Bill[];
  tags: string[];
  likes: string[]; // Array of user IDs who liked
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  _id: string;
  userId: string;
  username: string;
  userImage?: string;
  content: string;
  createdAt: string;
}

export function PostsFeed() {
  const { user, isSignedIn } = useUser();
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentContent[postId].trim()
        })
      });

      if (response.ok) {
        setCommentContent(prev => ({ ...prev, [postId]: '' }));
        fetchPosts();
      }
    } catch (error) {
      console.error('Error adding comment:', error);
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
    <div className="space-y-6">
      {/* Create Post Button */}
      {isSignedIn && !showCreatePost && (
        <Button
          onClick={() => setShowCreatePost(true)}
          className="w-full"
          size="lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create New Post
        </Button>
      )}

      {/* Create/Edit Post Form */}
      {showCreatePost && isSignedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {editingPost ? 'Edit Post' : 'Create New Post'}
              <Button variant="ghost" size="sm" onClick={resetCreateForm}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Post Type Selection */}
            <Tabs value={postType} onValueChange={(value) => setPostType(value as 'legislation' | 'bug_report')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="legislation" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Legislation Post
                </TabsTrigger>
                <TabsTrigger value="bug_report" className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Bug Report
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
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium mb-2">Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={postType === 'legislation' ? 'Explain your position, concerns, or analysis...' : 'Provide details about the bug, steps to reproduce, expected vs actual behavior...'}
                rows={6}
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
                    >
                      {showBillSearch ? 'Hide' : 'Show'} Bill Search
                    </Button>
                  </div>
                  {showBillSearch && (
                    <div className="p-4 bg-muted rounded-lg">
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
              <div className="flex gap-2 mb-2">
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
                />
                <Button onClick={addTag} variant="outline">
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0"
                      onClick={() => removeTag(tag)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              onClick={editingPost ? () => handleEditPost(editingPost) : handleCreatePost}
              className="w-full"
              disabled={!title.trim() || !content.trim()}
            >
              <Save className="h-4 w-4 mr-2" />
              {editingPost ? 'Update Post' : 'Create Post'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No posts yet
              </h3>
              <p className="text-sm text-muted-foreground">
                Be the first to share your thoughts on legislation or report a bug!
              </p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post._id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {post.userImage && (
                      <img
                        src={post.userImage}
                        alt={post.username}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{post.username}</span>
                        <Badge variant={post.type === 'legislation' ? 'default' : 'destructive'}>
                          {post.type === 'legislation' ? (
                            <>
                              <FileText className="h-3 w-3 mr-1" />
                              Legislation
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Bug Report
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Post Actions for Owner */}
                  {isSignedIn && user?.id === post.userId && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditPost(post)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePost(post._id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <CardTitle className="text-lg">{post.title}</CardTitle>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="whitespace-pre-wrap">{post.content}</p>

                {/* Linked Bills */}
                {post.linkedBills && post.linkedBills.length > 0 && (
                  <SelectedBills
                    selectedBills={post.linkedBills}
                    onRemoveBill={() => {}} // Read-only
                    onClearAll={() => {}} // Read-only
                    title="Referenced Bills"
                    description="Bills discussed in this post"
                  />
                )}

                {/* Tags */}
                {post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Post Actions */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLikePost(post._id)}
                      className={`flex items-center gap-2 ${
                        isSignedIn && post.likes.includes(user?.id || '') 
                          ? 'text-red-500' 
                          : ''
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${
                        isSignedIn && post.likes.includes(user?.id || '') 
                          ? 'fill-current' 
                          : ''
                      }`} />
                      {post.likes.length}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowComments(prev => ({
                        ...prev,
                        [post._id]: !prev[post._id]
                      }))}
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {post.comments.length}
                    </Button>
                  </div>
                </div>

                {/* Comments Section */}
                {showComments[post._id] && (
                  <div className="space-y-4 pt-4 border-t">
                    {/* Add Comment */}
                    {isSignedIn && (
                      <div className="flex gap-2">
                        <Textarea
                          value={commentContent[post._id] || ''}
                          onChange={(e) => setCommentContent(prev => ({
                            ...prev,
                            [post._id]: e.target.value
                          }))}
                          placeholder="Write a comment..."
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          onClick={() => handleAddComment(post._id)}
                          disabled={!commentContent[post._id]?.trim()}
                        >
                          Post
                        </Button>
                      </div>
                    )}

                    {/* Comments List */}
                    <div className="space-y-3">
                      {post.comments.map((comment) => (
                        <div key={comment._id} className="flex gap-3 p-3 bg-muted rounded-lg">
                          {comment.userImage && (
                            <img
                              src={comment.userImage}
                              alt={comment.username}
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{comment.username}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-sm">{comment.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
