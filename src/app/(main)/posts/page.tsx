import { PostsFeed } from "@/components/features/PostsFeed";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.posts;

export default function PostsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Community Posts</h1>
        <p className="text-muted-foreground">
          Share your thoughts on legislation, report bugs, and engage with the StatePulse community.
        </p>
      </div>

      <PostsFeed />
    </div>
  );
}
