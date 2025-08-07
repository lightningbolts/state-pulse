import { Metadata } from "next";
import { AnimatedSection } from "@/components/ui/AnimatedSection";

export const metadata: Metadata = {
  title: "About - StatePulse",
  description: "Learn about StatePulse's mission to make state and local legislation accessible to everyone.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 rounded-lg">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
            About StatePulse
          </h1>

          <div className="prose prose-lg max-w-none dark:prose-invert">
            <AnimatedSection className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">The Developer</h2>
                <p className="mb-4">
                  StatePulse was created by Kairui Cheng as a personal project to help him understand the complexities of state and local legislation. Curious about how laws are made and how they affect everyday life, Kairui set out to build a platform that would make it easier for anyone to access and understand legislative information.
                </p>
                <p className="mb-4">
                  The platform is designed to empower citizens by providing them with the tools they need to stay informed about the laws that govern their communities.
                </p>
                <p className="mb-4">
                  Kairui is an incoming freshman at the University of Washington - Seattle, majoring in Computer Science. In his free time, Kairui enjoys reading science fiction, coding, hiking Washington trails, running, and practicing the Alto Saxophone.
                </p>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Our Mission</h2>
              <p className="mb-4">
                StatePulse is dedicated to democratizing access to state and local legislation. We believe that every citizen deserves to understand the laws that govern their daily lives, from local zoning ordinances to state-wide policy changes.
              </p>
              <p className="mb-4">
                Our platform bridges the gap between complex legislative processes and everyday citizens, making it easier than ever to stay informed about the decisions that shape your community.
              </p>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">What We Do</h2>
              <p className="mb-4">
                StatePulse provides comprehensive tools and resources to help you:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Track legislation across all 50 states and thousands of local jurisdictions</li>
                <li>Receive AI-powered summaries of complex bills in plain English</li>
                <li>Get personalized notifications about bills that affect your interests</li>
                <li>Connect with your representatives and make your voice heard</li>
                <li>Engage with your community through our discussion platform</li>
                <li>Access voting information and candidate details for upcoming elections</li>
              </ul>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Why StatePulse Matters</h2>
              <p className="mb-4">
                State and local governments make thousands of decisions every year that directly impact your life - from education funding and healthcare policies to transportation infrastructure and environmental regulations. Yet most citizens remain unaware of these crucial decisions until it's too late to influence them.
              </p>
              <p className="mb-4">
                StatePulse changes that by providing real-time access to legislative information, breaking down barriers to civic engagement, and empowering citizens to participate meaningfully in the democratic process.
              </p>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Our Technology</h2>
              <p className="mb-4">
                We leverage cutting-edge artificial intelligence and machine learning to:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Automatically summarize complex legislation in multiple formats</li>
                <li>Identify bills that match your specific interests and location</li>
                <li>Provide intelligent insights about potential impacts of proposed laws</li>
                <li>Translate legal jargon into accessible language</li>
                <li>Predict voting outcomes and track bill progress</li>
              </ul>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Our Commitment</h2>
              <p className="mb-4">
                StatePulse is committed to:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li><strong>Accuracy:</strong> We source our data from official government channels and verify information through multiple sources</li>
                <li><strong>Neutrality:</strong> We present information objectively without political bias or agenda</li>
                <li><strong>Transparency:</strong> We're open about our data sources, methodologies, and any limitations in our coverage</li>
                <li><strong>Privacy:</strong> We protect your personal information and never share your data with third parties</li>
                <li><strong>Accessibility:</strong> We strive to make our platform usable by everyone, regardless of technical expertise or disability</li>
              </ul>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Get Involved</h2>
              <p className="mb-4">
                StatePulse is more than just a platform - it's a community of engaged citizens working together to strengthen democracy. Here's how you can get involved:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li>Create an account and start tracking legislation in your area</li>
                <li>Share your insights and engage in respectful discussions with other users</li>
                <li>Report bugs or suggest improvements to help us serve you better</li>
                <li>Spread the word about StatePulse to friends and family</li>
                <li>Contact your representatives about issues you care about</li>
              </ul>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="mb-4">
                We'd love to hear from you! Whether you have questions, feedback, or suggestions, don't hesitate to reach out:
              </p>
              <p className="mb-2">
                <strong>Email:</strong> contact@statepulse.me
              </p>
              <p className="mb-4">
                <strong>Response Time:</strong> We typically respond within 24-48 hours.
              </p>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Join the Movement</h2>
              <p className="mb-4">
                Democracy works best when citizens are informed and engaged. Join StatePulse today and become part of a movement that's making government more accessible, transparent, and responsive to the people it serves.
              </p>
              <p className="mb-4">
                Together, we can build a more informed and engaged citizenry - one bill, one vote, one voice at a time.
              </p>
            </AnimatedSection>

            <AnimatedSection className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Special Thanks</h2>
              <p className="mb-4">
                StatePulse would not be possible without the incredible work of open-source projects and organizations that share our commitment to transparency and accessibility:
              </p>
              <ul className="list-disc list-inside mb-4 space-y-2">
                <li><strong>Open States Project, supported by Plural Policy:</strong> For maintaining comprehensive databases of state legislative information that form the backbone of our legislative tracking capabilities.</li>
                <li><strong>MapLibre GL & OpenStreetMap:</strong> For providing the open-source mapping technology that powers our geographic features and helps users visualize legislation by location. Their commitment to free, open geographic data makes civic engagement more accessible to everyone.</li>
                <li><strong>The Open Data Community:</strong> For advocating for transparent government data and making it possible for platforms like StatePulse to exist.</li>
                <li><strong>Our Contributors:</strong> To everyone who reports bugs, suggests improvements, and helps make StatePulse better for the entire community.</li>
              </ul>
              <p className="mb-4">
                We believe in the power of collaboration and open data to strengthen democracy. Thank you to all the developers, researchers, and advocates who make civic technology possible.
              </p>
            </AnimatedSection>
          </div>
        </div>
      </div>
    </div>
  );
}
