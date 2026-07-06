import { PostsFeed } from "@/components/features/PostsFeed";
import { pageMetadata } from '@/lib/metadata';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelBody } from '@/components/layout/Panel';

export const metadata = pageMetadata.posts;

export default function PostsPage() {
  return (
    <div className="animate-content-in mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Community Posts"
        subtitle="Share your thoughts on legislation, report bugs, and engage with the StatePulse community."
      />
      <Panel>
        <PanelBody>
          <PostsFeed />
        </PanelBody>
      </Panel>
    </div>
  );
}
