"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  MessageSquare,
  FileText,
  Calendar,
  Heart,
  MessageCircle,
  AlertTriangle
} from "lucide-react";
import { Post, Comment } from "@/types/media";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

interface UserProfile {
  id: string;
  name?: string;
  email?: string;
  createdAt?: string;
  trackingTopics: string[];
  imageUrl?: string;
}

interface UserStats {
  postsCount: number;
  commentsCount: number;
}

export function UserProfile() {
  const params = useParams();
  const userId = params.userId as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [userComments, setUserComments] = useState<(Comment & { postTitle: string; postId: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId) {
      fetchUserProfile();
      fetchUserPosts();
      fetchUserComments();
    }
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setStats(data.stats);
      } else if (response.status === 404) {
        setError('User not found');
      } else {
        setError('Failed to load user profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const response = await fetch(`/api/posts?userId=${userId}`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const fetchUserComments = async () => {
    try {
      const response = await fetch(`/api/users/${userId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setUserComments(data.comments || []);
      }
    } catch (error) {
      console.error('Error fetching user comments:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="text-center py-8">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              {error}
            </h3>
            <p className="text-sm text-muted-foreground">
              The user profile you're looking for doesn't exist or couldn't be loaded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Profile Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
              {profile.imageUrl ? (
                <img
                  src={profile.imageUrl}
                  alt={profile.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="h-8 w-8 text-primary" />
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{profile.name || 'Anonymous User'}</CardTitle>
              {profile.createdAt && (
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">
                    Joined {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* User Stats */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats?.postsCount || 0}</div>
              <div className="text-sm text-muted-foreground">Posts</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats?.commentsCount || 0}</div>
              <div className="text-sm text-muted-foreground">Comments</div>
            </div>
          </div>

          {/* Tracking Topics */}
          {profile.trackingTopics && profile.trackingTopics.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Tracking Topics</h3>
              <div className="flex flex-wrap gap-2">
                {profile.trackingTopics.map((topic) => (
                  <Badge key={topic} variant="secondary" className="text-xs">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts and Comments Tabs */}
      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Posts ({posts.length})
          </TabsTrigger>
          <TabsTrigger value="comments" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Comments ({userComments.length})
          </TabsTrigger>
        </TabsList>

        {/* Posts Tab */}
        <TabsContent value="posts" className="space-y-4">
          {posts.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No posts yet
                </h3>
                <p className="text-sm text-muted-foreground">
                  This user hasn't created any posts yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post, i) => (
              <AnimatedSection key={post._id} style={{ transitionDelay: `${i * 60}ms` }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={post.type === 'legislation' ? 'default' : 'destructive'} className="text-xs">
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
                      <span className="text-sm text-muted-foreground">
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{post.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed mb-4">{post.content}</p>

                    {/* Tags */}
                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Post Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {post.likes.length}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        {post.comments.length}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))
          )}
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="space-y-4">
          {userComments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">
                  No comments yet
                </h3>
                <p className="text-sm text-muted-foreground">
                  This user hasn't commented on any posts yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            userComments.map((comment, i) => (
              <AnimatedSection key={comment._id} style={{ transitionDelay: `${i * 60}ms` }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Comment on: <span className="font-medium">{comment.postTitle}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed">{comment.content}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
