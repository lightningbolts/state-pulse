import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelBody } from '@/components/layout/Panel';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.about;

export default function AboutPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader title="About StatePulse" subtitle="Democratizing access to state and local legislation." />
      <Panel>
        <PanelBody className="prose prose-sm max-w-none dark:prose-invert sm:prose-base">
          <h2>The Developer</h2>
          <p>
            StatePulse was created by Kairui Cheng as a personal project to help him understand the complexities of state and local legislation.
          </p>
          <h2>Our Mission</h2>
          <p>
            StatePulse is dedicated to democratizing access to state and local legislation. We believe that every citizen deserves to understand the laws that govern their daily lives.
          </p>
          <h2>What We Do</h2>
          <ul>
            <li>Track legislation across all 50 states and thousands of local jurisdictions</li>
            <li>Receive AI-powered summaries of complex bills in plain English</li>
            <li>Get personalized notifications about bills that affect your interests</li>
            <li>Connect with your representatives and make your voice heard</li>
          </ul>
          <h2>Contact Us</h2>
          <p><strong>Email:</strong> contact@statepulse.me</p>
        </PanelBody>
      </Panel>
    </div>
  );
}
