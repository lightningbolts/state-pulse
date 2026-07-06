import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Panel, PanelBody } from '@/components/layout/Panel';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.about;

function AboutSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel title={title} className={className}>
      <PanelBody className="space-y-3 text-sm leading-relaxed text-muted-foreground sm:text-base [&_a]:text-primary [&_a]:underline [&_li]:leading-relaxed [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
        {children}
      </PanelBody>
    </Panel>
  );
}

export default function AboutPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="About StatePulse"
        subtitle="Democratizing access to state and local legislation."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AboutSection title="The Developer">
          <p>
            StatePulse was created by Kairui Cheng as a personal project to help him understand the complexities of state and local legislation. Curious about how laws are made and how they affect everyday life, Kairui set out to build a platform that would make it easier for anyone to access and understand legislative information.
          </p>
          <p>
            The platform is designed to empower citizens by providing them with the tools they need to stay informed about the laws that govern their communities.
          </p>
          <p>
            Kairui is a current freshman at the University of Washington - Seattle, majoring in Computer Science. In his free time, Kairui enjoys reading science fiction, coding, hiking Washington trails, running, and practicing the Alto Saxophone.
          </p>
        </AboutSection>

        <AboutSection title="Our Mission">
          <p>
            StatePulse is dedicated to democratizing access to state and local legislation. We believe that every citizen deserves to understand the laws that govern their daily lives, from local zoning ordinances to state-wide policy changes.
          </p>
          <p>
            Our platform bridges the gap between complex legislative processes and everyday citizens, making it easier than ever to stay informed about the decisions that shape your community.
          </p>
        </AboutSection>
      </div>

      <AboutSection title="What We Do">
        <p>StatePulse provides comprehensive tools and resources to help you:</p>
        <ul>
          <li>Track legislation across all 50 states and thousands of local jurisdictions</li>
          <li>Receive AI-powered summaries of complex bills in plain English</li>
          <li>Get personalized notifications about bills that affect your interests</li>
          <li>Connect with your representatives and make your voice heard</li>
          <li>Engage with your community through our discussion platform</li>
          <li>Access voting information and candidate details for upcoming elections</li>
        </ul>
      </AboutSection>

      <AboutSection title="Why StatePulse Matters">
        <p>
          State and local governments make thousands of decisions every year that directly impact your life - from education funding and healthcare policies to transportation infrastructure and environmental regulations. Yet most citizens remain unaware of these crucial decisions until it&apos;s too late to influence them.
        </p>
        <p>
          StatePulse changes that by providing real-time access to legislative information, breaking down barriers to civic engagement, and empowering citizens to participate meaningfully in the democratic process.
        </p>
      </AboutSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AboutSection title="Our Technology">
          <p>We leverage artificial intelligence and machine learning to:</p>
          <ul>
            <li>Automatically summarize complex legislation in multiple formats</li>
            <li>Identify bills that match your specific interests and location</li>
            <li>Provide intelligent insights about potential impacts of proposed laws</li>
            <li>Translate legal jargon into accessible language</li>
            <li>Predict voting outcomes and track bill progress</li>
          </ul>
        </AboutSection>

        <AboutSection title="Our Commitment">
          <ul>
            <li><strong>Accuracy:</strong> We source our data from official government channels and verify information through multiple sources</li>
            <li><strong>Neutrality:</strong> We present information objectively without political bias or agenda</li>
            <li><strong>Transparency:</strong> We&apos;re open about our data sources, methodologies, and any limitations in our coverage</li>
            <li><strong>Privacy:</strong> We protect your personal information and never share your data with third parties</li>
            <li><strong>Accessibility:</strong> We strive to make our platform usable by everyone, regardless of technical expertise or disability</li>
          </ul>
        </AboutSection>
      </div>

      <AboutSection title="Get Involved">
        <p>
          StatePulse is more than just a platform - it&apos;s a community of engaged citizens working together to strengthen democracy. Here&apos;s how you can get involved:
        </p>
        <ul>
          <li>Create an account and start tracking legislation in your area</li>
          <li>Share your insights and engage in respectful discussions with other users</li>
          <li>Report bugs or suggest improvements to help us serve you better</li>
          <li>Spread the word about StatePulse to friends and family</li>
          <li>Contact your representatives about issues you care about</li>
        </ul>
      </AboutSection>

      <div className="grid gap-6 lg:grid-cols-2">
        <AboutSection title="Contact Us">
          <p>
            We&apos;d love to hear from you! Whether you have questions, feedback, or suggestions, don&apos;t hesitate to reach out:
          </p>
          <p><strong>Email:</strong>{' '}<a href="mailto:contact@statepulse.me">contact@statepulse.me</a></p>
          <p><strong>Response Time:</strong> We typically respond within 24-48 hours.</p>
        </AboutSection>

        <AboutSection title="Join the Movement">
          <p>
            Democracy works best when citizens are informed and engaged. Join StatePulse today and become part of a movement that&apos;s making government more accessible, transparent, and responsive to the people it serves.
          </p>
          <p>
            Together, we can build a more informed and engaged citizenry - one bill, one vote, one voice at a time.
          </p>
          <p>
            <Link href="/sign-up" prefetch className="font-medium">
              Create a free account →
            </Link>
          </p>
        </AboutSection>
      </div>

      <AboutSection title="Special Thanks">
        <p>
          StatePulse would not be possible without the incredible work of open-source projects and organizations that share our commitment to transparency and accessibility:
        </p>
        <ul>
          <li>
            <strong><a href="https://pluralpolicy.com/">Open States Project, supported by Plural Policy</a></strong>
            {' '}— comprehensive databases of state legislative information that form the backbone of our tracking capabilities.
          </li>
          <li>
            <strong><a href="https://maplibre.org/">MapLibre GL &amp; OpenStreetMap</a></strong>
            {' '}— open-source mapping technology that powers our geographic features and helps users visualize legislation by location.
          </li>
          <li><strong>The Open Data Community</strong> — advocating for transparent government data and making platforms like StatePulse possible.</li>
          <li>
            <strong><a href="https://www.readtangle.com/">Tangle</a></strong>
            {' '}— part of the inspiration for this project, and for their work in making nonpartisan news.
          </li>
          <li><strong>Our Contributors</strong> — everyone who reports bugs, suggests improvements, and helps make StatePulse better for the entire community.</li>
        </ul>
        <p>
          We believe in the power of collaboration and open data to strengthen democracy. Thank you to all the developers, researchers, and advocates who make civic technology possible.
        </p>
      </AboutSection>
    </div>
  );
}
