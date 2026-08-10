import { generateMetadata } from '@/lib/metadata';
import { PageHeader } from '@/components/layout/PageHeader';
import AdminEmailsClient from './AdminEmailsClient';

export const metadata = {
  ...generateMetadata({
    title: 'Admin · Email Broadcast',
    description: 'Send StatePulse service announcements to the email list.',
    url: '/admin/emails',
  }),
  robots: { index: false, follow: false },
};

export default function AdminEmailsPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Email Broadcast"
        subtitle="Send service announcements to everyone on the StatePulse email list via Brevo SMTP."
      />
      <AdminEmailsClient />
    </div>
  );
}
