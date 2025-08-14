import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.privacy;

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <AnimatedSection>
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      </AnimatedSection>
      <div className="prose prose-gray max-w-none">
        <AnimatedSection>
          <p className="text-muted-foreground mb-6">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </AnimatedSection>
        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
            <p className="mb-4">
              StatePulse ("we," "our," or "us") is committed to protecting your
              privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our web application and
              services.
            </p>
          </section>
        </AnimatedSection>
        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>

            <h3 className="text-xl font-medium mb-3">Personal Information</h3>
            <p className="mb-4">
              We may collect personal information that you voluntarily provide to
              us, including:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Name and email address when you create an account</li>
              <li>Location information to provide relevant legislative data</li>
              <li>Communication preferences and settings</li>
              <li>Feedback and correspondence you send to us</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">Usage Information</h3>
            <p className="mb-4">
              We automatically collect certain information about your use of our
              service:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Device information and browser type</li>
              <li>IP address and general location</li>
              <li>Pages visited and features used</li>
              <li>Time spent on the application</li>
            </ul>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
            <p className="mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Provide and maintain our services</li>
              <li>Personalize your experience with relevant legislative information</li>
              <li>Send you important updates and notifications</li>
              <li>Improve our services and develop new features</li>
              <li>Ensure the security and integrity of our platform</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Information Sharing</h2>
            <p className="mb-4">
              We do not sell, trade, or otherwise transfer your personal
              information to third parties except in the following circumstances:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>With your explicit consent</li>
              <li>To comply with legal requirements or court orders</li>
              <li>To protect our rights, property, or safety</li>
              <li>With trusted service providers who assist in operating our platform</li>
            </ul>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Data Security</h2>
            <p className="mb-4">
              We implement appropriate technical and organizational measures to
              protect your personal information against unauthorized access,
              alteration, disclosure, or destruction. However, no method of
              transmission over the internet is 100% secure.
            </p>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside mb-4 space-y-1">
              <li>Access and review your personal information</li>
              <li>Request corrections to inaccurate information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt-out of certain communications</li>
              <li>Export your data in a portable format</li>
            </ul>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Cookies and Tracking</h2>
            <p className="mb-4">
              We use cookies and similar tracking technologies to enhance your
              experience, analyze usage patterns, and improve our services. You
              can control cookie settings through your browser preferences.
            </p>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. We will notify
              you of any changes by posting the new Privacy Policy on this page
              and updating the "Last updated" date.
            </p>
          </section>
        </AnimatedSection>

        <AnimatedSection>
          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy or our data
              practices, please contact us at:
            </p>
            <p className="mb-2">
              <strong>Email:</strong> contact@statepulse.me
            </p>
          </section>
        </AnimatedSection>
      </div>
    </div>
  );
}
