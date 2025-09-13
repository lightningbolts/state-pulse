import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

export default function LearnFAQPage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-4 md:px-0">
      <AnimatedSection className="mb-12">
        <h1 className="font-headline text-3xl md:text-4xl font-bold mb-4 text-primary">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-6 text-lg">
          Find answers to common questions about StatePulse and how to make the most of our legislative tracking platform.
        </p>
      </AnimatedSection>

      <div className="space-y-12">
        {/* Getting Started */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Getting Started</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-blue-500/30 dark:border-blue-400/50 pl-6 bg-blue-50/30 dark:bg-blue-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What is StatePulse?</h3>
                <p className="text-muted-foreground leading-relaxed">StatePulse is a comprehensive platform for tracking state and federal legislation. We provide quick updates on bills, AI-powered summaries, representative information, and tools to help you engage with the legislative process across all 50 states and Congress.</p>
              </div>
              <div className="border-l-4 border-blue-500/30 dark:border-blue-400/50 pl-6 bg-blue-50/30 dark:bg-blue-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">Is StatePulse free to use?</h3>
                <p className="text-muted-foreground leading-relaxed">Yes! StatePulse is completely free to use for individuals. We believe civic engagement should be accessible to everyone. You can create an account, track legislation, follow representatives, and use all our features at no cost. Donations are always appreciated at <Link href="https://buymeacoffee.com/timberlake2025" className="text-blue-500 hover:underline">our donation page</Link>.</p>
              </div>
              <div className="border-l-4 border-blue-500/30 dark:border-blue-400/50 pl-6 bg-blue-50/30 dark:bg-blue-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">Do I need an account to browse legislation?</h3>
                <p className="text-muted-foreground leading-relaxed">No, you can browse legislation, view summaries, and explore representative information without signing up. However, creating a free account allows you to bookmark bills, follow representatives, track specific topics, and receive email notifications.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Tracking & Following */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Tracking & Following</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-green-500/30 dark:border-green-400/50 pl-6 bg-green-50/30 dark:bg-green-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How do I track legislation?</h3>
                <p className="text-muted-foreground leading-relaxed">You can track legislation in several ways: bookmark specific bills by clicking the bookmark icon, subscribe to topic alerts to get updates on subjects you care about (like "healthcare" or "education"), or follow representatives to see all the legislation they sponsor.</p>
              </div>
              <div className="border-l-4 border-green-500/30 dark:border-green-400/50 pl-6 bg-green-50/30 dark:bg-green-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How do I follow and share a representative?</h3>
                <p className="text-muted-foreground leading-relaxed">Visit any representative's profile page and click the "Follow" button. You can also find representatives using our Representative Finder tool in the Civic Tools section. Following a representative allows you to get notified when they sponsor or co-sponsor new legislation. To share a representative's profile, simply click the "Share" button and choose your preferred sharing method.</p>
              </div>
              <div className="border-l-4 border-green-500/30 dark:border-green-400/50 pl-6 bg-green-50/30 dark:bg-green-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What's the difference between bookmarking and topic subscriptions?</h3>
                <p className="text-muted-foreground leading-relaxed">Bookmarking saves specific bills to your personal collection for easy access later. Topic subscriptions notify you about any new legislation related to subjects you're interested in (like "environment," "taxes," etc.). Both are accessible from your Dashboard.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Features & Tools */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Features & Tools</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-purple-500/30 dark:border-purple-400/50 pl-6 bg-purple-50/30 dark:bg-purple-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What are AI summaries and how accurate are they?</h3>
                <p className="text-muted-foreground leading-relaxed">Our AI summaries break down complex legislative language into plain English, highlighting key provisions, impacts, and changes. While our AI is trained on legislative content and provides helpful overviews, you should always refer to the full bill text for legal precision.</p>
              </div>
              <div className="border-l-4 border-purple-500/30 dark:border-purple-400/50 pl-6 bg-purple-50/30 dark:bg-purple-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What are voting predictions?</h3>
                <p className="text-muted-foreground leading-relaxed">Our AI-powered voting predictions analyze bill content, sponsor information, political context, and historical patterns to estimate the likelihood of legislation passing. These are educational estimates based on available data, not definitive forecasts.</p>
              </div>
              <div className="border-l-4 border-purple-500/30 dark:border-purple-400/50 pl-6 bg-purple-50/30 dark:bg-purple-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How do I find my representatives?</h3>
                <p className="text-muted-foreground leading-relaxed">Use the Representative Finder in our Civic Tools section. Enter your address, and we'll show you your federal and state representatives, including their contact information, recent legislative activity, and voting history where available.</p>
              </div>
              <div className="border-l-4 border-purple-500/30 dark:border-purple-400/50 pl-6 bg-purple-50/30 dark:bg-purple-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What civic tools are available?</h3>
                <p className="text-muted-foreground leading-relaxed">Our Civic Tools include: Representative Finder (locate your elected officials), AI Message Generator (craft personalized letters to legislators), contact information for all representatives, and guidance on effective civic engagement. Additionally, you can check the Dashboard to visualize legislative districts and representatives.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Notifications & Updates */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Notifications & Updates</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-yellow-500/30 dark:border-yellow-400/50 pl-6 bg-yellow-50/30 dark:bg-yellow-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How do email notifications work?</h3>
                <p className="text-muted-foreground leading-relaxed">You can receive two types of email notifications: Sponsorship Alerts and Topic Alerts (when representatives you follow introduce new bills or topics with updates) and Weekly Digest (a summary of all your tracked activity). Manage these preferences from your Dashboard or Tracker page.</p>
              </div>
              <div className="border-l-4 border-yellow-500/30 dark:border-yellow-400/50 pl-6 bg-yellow-50/30 dark:bg-yellow-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How often will I receive emails?</h3>
                <p className="text-muted-foreground leading-relaxed">Sponsorship alerts are sent as they happen (when your followed representatives sponsor bills). Weekly digests are sent once per week with a summary of all activity. You can enable or disable either type in your notification preferences.</p>
              </div>
              <div className="border-l-4 border-yellow-500/30 dark:border-yellow-400/50 pl-6 bg-yellow-50/30 dark:bg-yellow-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">Can I unsubscribe from emails?</h3>
                <p className="text-muted-foreground leading-relaxed">Yes, you can manage your notification preferences in your Dashboard, or use the unsubscribe link at the bottom of any notification email. You can also disable specific types of notifications while keeping others active.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Understanding Legislation */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Understanding Legislation</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-red-500/30 dark:border-red-400/50 pl-6 bg-red-50/30 dark:bg-red-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What do the different bill statuses mean?</h3>
                <p className="text-muted-foreground leading-relaxed"><strong className="text-foreground">Introduced:</strong> Bill has been formally submitted. <strong className="text-foreground">In Committee:</strong> Under review by a legislative committee. <strong className="text-foreground">Passed Chamber:</strong> Approved by one legislative body. <strong className="text-foreground">Enacted:</strong> Signed into law. <strong className="text-foreground">Dead/Failed:</strong> Did not advance or was voted down.</p>
              </div>
              <div className="border-l-4 border-red-500/30 dark:border-red-400/50 pl-6 bg-red-50/30 dark:bg-red-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">What's the difference between sponsors and co-sponsors?</h3>
                <p className="text-muted-foreground leading-relaxed">The sponsor is the legislator who introduces and takes primary responsibility for a bill. Co-sponsors are other legislators who formally support the bill and add their names to show backing, which can help build momentum for passage.</p>
              </div>
              <div className="border-l-4 border-red-500/30 dark:border-red-400/50 pl-6 bg-red-50/30 dark:bg-red-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How do I understand executive orders?</h3>
                <p className="text-muted-foreground leading-relaxed">Executive orders are directives issued by governors or the president that have the force of law within their jurisdiction. We track these separately from legislation since they don't go through the legislative process but can significantly impact policy.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Technical & Data */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Data & Coverage</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-teal-500/30 dark:border-teal-400/50 pl-6 bg-teal-50/30 dark:bg-teal-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">Which jurisdictions does StatePulse cover?</h3>
                <p className="text-muted-foreground leading-relaxed">StatePulse covers all 50 U.S. states plus federal legislation from the U.S. Congress. Our data comes from official government sources and the Open States Project.</p>
              </div>
              <div className="border-l-4 border-teal-500/30 dark:border-teal-400/50 pl-6 bg-teal-50/30 dark:bg-teal-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How often is the data updated?</h3>
                <p className="text-muted-foreground leading-relaxed">We update our legislative data multiple times per day to ensure you have access to the most current information. Bill statuses, new introductions, and voting results are typically reflected within hours of official reporting.</p>
              </div>
              <div className="border-l-4 border-teal-500/30 dark:border-teal-400/50 pl-6 bg-teal-50/30 dark:bg-teal-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">Can I access historical legislation?</h3>
                <p className="text-muted-foreground leading-relaxed">Yes, our database includes historical legislation going back several years, depending on the jurisdiction. You can filter by date ranges and search through archived bills to research past legislative activity and trends.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Privacy & Support */}
        <AnimatedSection>
          <section>
            <h2 className="font-semibold text-2xl mb-6 text-primary border-b border-border/50 pb-3">Privacy & Support</h2>
            <div className="space-y-6">
              <div className="border-l-4 border-slate-500/30 dark:border-slate-400/50 pl-6 bg-slate-50/30 dark:bg-slate-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How is my data protected?</h3>
                <p className="text-muted-foreground leading-relaxed">We take privacy seriously. Your personal information and tracking preferences are encrypted and securely stored. We never sell your data or share it with third parties. See our Privacy Policy for complete details on data handling and your rights.</p>
              </div>
              <div className="border-l-4 border-slate-500/30 dark:border-slate-400/50 pl-6 bg-slate-50/30 dark:bg-slate-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">How can I contact support or provide feedback?</h3>
                <p className="text-muted-foreground leading-relaxed">You can reach us at <a href="mailto:contact@statepulse.me" className="text-primary hover:text-primary/80 underline underline-offset-2">contact@statepulse.me</a> for support questions, bug reports, or feature suggestions. We're continuously improving StatePulse based on user feedback.</p>
              </div>
              <div className="border-l-4 border-slate-500/30 dark:border-slate-400/50 pl-6 bg-slate-50/30 dark:bg-slate-950/20 rounded-r-lg py-4">
                <h3 className="font-semibold mb-3 text-lg text-foreground">Is StatePulse affiliated with any political organization?</h3>
                <p className="text-muted-foreground leading-relaxed">No, StatePulse is an independent, non-partisan platform. We provide objective information about legislation and representatives without political bias. Our goal is to make civic engagement accessible to everyone, regardless of political affiliation.</p>
              </div>
            </div>
          </section>
        </AnimatedSection>

        {/* Call to Action */}
        <AnimatedSection>
          <div className="mt-16 p-8 bg-muted/50 dark:bg-muted/30 rounded-xl border border-border/50">
            <h3 className="font-semibold text-xl mb-4 text-foreground">Still have questions?</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              If you couldn't find what you were looking for, we're here to help! Feel free to reach out with any questions about using StatePulse or understanding the legislative process.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild>
                <a href="mailto:contact@statepulse.me">
                  Contact Support
                </a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/about">
                  Learn More About StatePulse
                </Link>
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </main>
  );
}
