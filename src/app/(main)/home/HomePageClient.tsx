"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, BarChart3, Landmark, Newspaper } from 'lucide-react';
import { AnimatedSection } from '@/components/ui/AnimatedSection';

import dynamic from 'next/dynamic';
import { useUser } from '@clerk/nextjs';
const ParallaxShowcase = dynamic(() => import('./ParallaxShowcase'), { ssr: false });

export default function HomePageClient() {
  const { isSignedIn } = useUser();
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <AnimatedSection className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground py-24 px-6 md:px-10 text-center rounded-md shadow-lg overflow-hidden">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
          Welcome to StatePulse
        </h1>
        <p className="text-lg md:text-xl text-primary-foreground/90 mb-10 max-w-3xl mx-auto leading-relaxed">
          Your comprehensive source for fast legislative tracking and policy analysis. Stay informed, make impactful decisions.
        </p>
        <div className="space-x-2 sm:space-x-4">
          <Button asChild size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 shadow-md hover:shadow-lg transition-shadow px-8 py-3 rounded-lg">
            <Link href="/legislation">
              Explore Legislation <ArrowRight className="ml-2.5 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="border-2 border-white/80 text-white bg-white/10 hover:bg-white/20 hover:text-white hover:border-white shadow-md hover:shadow-lg transition-all duration-200 px-8 py-3 rounded-lg backdrop-blur-sm">
            <Link href="/about">
              Learn More
            </Link>
          </Button>
        </div>
      </AnimatedSection>


      {/* Features Section */}
      <AnimatedSection className="py-20 px-6 md:px-10">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4 tracking-tight">Why StatePulse?</h2>
          <p className="text-muted-foreground text-lg mb-16 max-w-2xl mx-auto leading-relaxed">
            We provide the tools and insights you need to navigate the complex world of state-level policy.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            <Card className="text-left shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-card rounded-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center mb-3">
                  <Newspaper className="h-10 w-10 text-primary mr-4" />
                  <div>
                    <CardTitle className="text-2xl font-semibold">Quick Updates</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Access the latest information on bills, resolutions, and policy changes as they happen.
                </p>
              </CardContent>
            </Card>
            <Card className="text-left shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-card rounded-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center mb-3">
                  <Landmark className="h-10 w-10 text-primary mr-4" />
                  <div>
                    <CardTitle className="text-2xl font-semibold">Comprehensive Coverage</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Track legislation across multiple states and jurisdictions from a single platform.
                </p>
              </CardContent>
            </Card>
            <Card className="text-left shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-card rounded-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center mb-3">
                  <BarChart3 className="h-10 w-10 text-primary mr-4" />
                  <div>
                    <CardTitle className="text-2xl font-semibold">Insightful Analytics</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  Understand trends and impacts with our data visualization tools.
                  <span className="block text-sm text-primary/80 mt-1 font-medium">(Coming Soon!)</span>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </AnimatedSection>

      {/* Parallax Showcase Section */}
      {/* <ParallaxShowcase /> */}

      {/* Call to Action Section */}
      <AnimatedSection className="bg-muted/70 py-20 px-6 md:px-10 rounded-md shadow-lg overflow-hidden">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-6 tracking-tight">
            Ready to Dive In?
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Start exploring legislation now or sign up for personalized alerts and features.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isSignedIn ? (
              <Button asChild size="lg" className="px-10 py-3 shadow-md hover:shadow-lg transition-shadow rounded-lg">
                <Link href="/sign-up">
                  Create a Free Account
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg" className="px-10 py-3 shadow-md hover:shadow-lg transition-shadow rounded-lg">
                <Link href="/posts">
                  View Community Posts
                </Link>
              </Button>
            )}
            <Button asChild size="lg" variant="outline" className="px-10 py-3 shadow-md hover:shadow-lg transition-shadow rounded-lg">
              <Link href="/dashboard">
                View Dashboard
              </Link>
            </Button>
          </div>
        </div>
      </AnimatedSection>
    {/* Donate Callout Section */}
    <AnimatedSection className="bg-yellow-100 py-14 px-6 md:px-10 rounded-md shadow-lg overflow-hidden mt-12 flex flex-col items-center">
      <h2 className="text-3xl md:text-4xl font-bold mb-4 text-yellow-900 tracking-tight">Support StatePulse</h2>
      <p className="text-lg md:text-xl text-yellow-900/90 mb-8 max-w-2xl mx-auto leading-relaxed text-center">
        If you find StatePulse valuable, consider supporting our work! Your donation helps us keep the platform running and free for everyone.
      </p>
      <a
        href="https://buymeacoffee.com/timberlake2025"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block"
      >
        <Button className="bg-yellow-400 text-black hover:bg-yellow-300 font-semibold shadow-md px-8 py-3 rounded-lg text-lg transition-colors" asChild>
          <span>Donate</span>
        </Button>
      </a>
    </AnimatedSection>
  </div>
  );
}
