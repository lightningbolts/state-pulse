// filepath: /Users/timberlake2025/Code/state-pulse/src/app/(main)/ImportanceShowcase.tsx
"use client";

import { AnimatedSection } from "@/components/ui/AnimatedSection";

export default function ImportanceShowcase() {
  return (
    <>
      <AnimatedSection className="py-20 px-6 md:px-10 bg-background text-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4 tracking-tight">Stay Civically Informed</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              StatePulse is dedicated to democratizing access to state and local legislation. We believe that every person deserves to understand the laws that govern their daily lives, from local zoning ordinances to state-wide policy changes. Being aware of civic processes and policy decisions lets you advocate for your community, engage meaningfully in democracy, and help shape the future of the laws that impact your daily life.
          </p>
        </div>
      </AnimatedSection>

      {/*/!* What We Do Section *!/*/}
      {/*<AnimatedSection className="py-16 px-6 md:px-10 bg-background text-foreground">*/}
      {/*  <div className="container mx-auto">*/}
      {/*    <h3 className="text-3xl font-semibold mb-8 text-center">What We Do</h3>*/}
      {/*    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">*/}
      {/*      {[*/}
      {/*        { icon: MapPin, title: 'Track Legislation', desc: 'Across all 50 states and local jurisdictions in real time.' },*/}
      {/*        { icon: BookOpen, title: 'AI Summaries', desc: 'Complex bills translated into clear, concise summaries.' },*/}
      {/*        { icon: Bell, title: 'Personalized Alerts', desc: 'Notifications for bills and topics you care about.' },*/}
      {/*        { icon: Users, title: 'Representative Connect', desc: 'Direct links to your elected officials.' },*/}
      {/*        { icon: MessageSquare, title: 'Community Discussions', desc: 'Engage with fellow citizens on policy.' },*/}
      {/*        { icon: CheckSquare, title: 'Voting Resources', desc: 'Candidate info and election details.' },*/}
      {/*      ].map(({ icon: Icon, title, desc }, idx) => (*/}
      {/*        <Card key={idx} className="text-center p-6">*/}
      {/*          <CardHeader>*/}
      {/*            <Icon className="h-8 w-8 text-primary mx-auto mb-4" />*/}
      {/*            <CardTitle className="text-xl font-medium">{title}</CardTitle>*/}
      {/*          </CardHeader>*/}
      {/*          <CardContent>*/}
      {/*            <p className="text-muted-foreground">{desc}</p>*/}
      {/*          </CardContent>*/}
      {/*        </Card>*/}
      {/*      ))}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</AnimatedSection>*/}

      {/*/!* Get Involved Section *!/*/}
      {/*<AnimatedSection className="py-16 px-6 md:px-10 bg-background text-foreground">*/}
      {/*  <div className="container mx-auto">*/}
      {/*    <h3 className="text-3xl font-semibold mb-8 text-center">Get Involved</h3>*/}
      {/*    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">*/}
      {/*      {[*/}
      {/*        { icon: UserPlus, title: 'Join Us', desc: 'Create an account and personalize your StatePulse experience.' },*/}
      {/*        { icon: MessageCircle, title: 'Share Insights', desc: 'Engage in respectful policy discussions.' },*/}
      {/*        { icon: Bug, title: 'Report Issues', desc: 'Help us improve by reporting bugs or suggestions.' },*/}
      {/*        { icon: Share2, title: 'Spread the Word', desc: 'Invite friends and grow our civic community.' },*/}
      {/*        { icon: Mail, title: 'Contact Officials', desc: 'Reach out to representatives on issues you care about.' },*/}
      {/*      ].map(({ icon: Icon, title, desc }, idx) => (*/}
      {/*        <Card key={idx} className="text-center p-6">*/}
      {/*          <CardHeader>*/}
      {/*            <Icon className="h-8 w-8 text-primary mx-auto mb-4" />*/}
      {/*            <CardTitle className="text-xl font-medium">{title}</CardTitle>*/}
      {/*          </CardHeader>*/}
      {/*          <CardContent>*/}
      {/*            <p className="text-muted-foreground">{desc}</p>*/}
      {/*          </CardContent>*/}
      {/*        </Card>*/}
      {/*      ))}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*</AnimatedSection>*/}
    </>
  );
}
