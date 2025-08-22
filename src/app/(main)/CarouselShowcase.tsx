"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AnimatedSection } from '@/components/ui/AnimatedSection';
import { ChevronLeft, ChevronRight, FileText, Users, MessageSquare, MapPin, Calendar, TrendingUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface CarouselItem {
  id: string;
  category: 'legislation' | 'representatives' | 'posts';
  title: string;
  subtitle: string;
  description: string;
  image?: string;
  link: string;
  badge?: string;
  stats?: {
    label: string;
    value: string;
  }[];
}

const showcaseItems: CarouselItem[] = [
  // Legislation Items
  {
    id: 'leg-1',
    category: 'legislation',
    title: 'Track Legislative Activity',
    subtitle: 'Stay informed about bills and resolutions',
    description: 'Monitor legislation across all states with real-time updates, summaries, and voting records. Get notified when bills you care about change status.',
    link: '/legislation',
    badge: 'Live Updates',
    stats: [
      { label: 'Active Bills', value: '15K+' },
      { label: 'States Covered', value: '50' },
      { label: 'Daily Updates', value: '500+' }
    ]
  },
  {
    id: 'leg-2',
    category: 'legislation',
    title: 'Bill Analysis & Summaries',
    subtitle: 'Understand complex legislation',
    description: 'Get AI-powered summaries and analysis of bills. Break down complex legal language into easy-to-understand insights.',
    link: '/legislation',
    badge: 'AI Powered',
    stats: [
      { label: 'Bills Analyzed', value: '12K+' },
      { label: 'Avg Read Time', value: '2 min' },
      { label: 'Accuracy Rate', value: '95%' }
    ]
  },
  // Representatives Items
  {
    id: 'rep-1',
    category: 'representatives',
    title: 'Find Your Representatives',
    subtitle: 'Connect with your elected officials',
    description: 'Discover who represents you at state and federal levels. Get contact information, voting records, and sponsored legislation.',
    link: '/representatives',
    badge: 'Interactive Maps',
    stats: [
      { label: 'Representatives', value: '7,500+' },
      { label: 'Contact Methods', value: 'Multiple' },
      { label: 'Coverage', value: 'All Levels' }
    ]
  },
  {
    id: 'rep-2',
    category: 'representatives',
    title: 'Legislative Performance',
    subtitle: 'Track representative activity',
    description: 'See how your representatives vote, what bills they sponsor, and their legislative priorities. Make informed decisions at election time.',
    link: '/representatives',
    badge: 'Voting Records',
    stats: [
      { label: 'Bills Tracked', value: '25K+' },
      { label: 'Voting Records', value: 'Complete' },
      { label: 'Party Analysis', value: 'Available' }
    ]
  },
  // Posts Items
  {
    id: 'post-1',
    category: 'posts',
    title: 'Community Discussions',
    subtitle: 'Join the conversation',
    description: 'Engage with other citizens about important legislation. Share insights, ask questions, and build understanding together.',
    link: '/posts',
    badge: 'Community Driven',
    stats: [
      { label: 'Active Users', value: '5K+' },
      { label: 'Discussions', value: '1,200+' },
      { label: 'Daily Posts', value: '50+' }
    ]
  },
  {
    id: 'post-2',
    category: 'posts',
    title: 'Expert Analysis',
    subtitle: 'Learn from policy experts',
    description: 'Read insights from policy experts, legal professionals, and engaged citizens. Get different perspectives on important issues.',
    link: '/posts',
    badge: 'Expert Insights',
    stats: [
      { label: 'Expert Contributors', value: '200+' },
      { label: 'Analysis Posts', value: '800+' },
      { label: 'Topics Covered', value: '100+' }
    ]
  }
];

const categoryConfig = {
  legislation: {
    icon: FileText,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    accentColor: 'bg-blue-600'
  },
  representatives: {
    icon: Users,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    accentColor: 'bg-green-600'
  },
  posts: {
    icon: MessageSquare,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    accentColor: 'bg-purple-600'
  }
};

export default function CarouselShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-advance carousel
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % showcaseItems.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setIsAutoPlaying(false);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + showcaseItems.length) % showcaseItems.length);
    setIsAutoPlaying(false);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % showcaseItems.length);
    setIsAutoPlaying(false);
  };

  const currentItem = showcaseItems[currentIndex];
  const CategoryIcon = categoryConfig[currentItem.category].icon;

  return (
    <AnimatedSection className="py-20 px-6 md:px-10 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 tracking-tight">
            Explore StatePulse Features
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Discover how StatePulse helps you stay informed about legislation, connect with representatives, and engage with your community.
          </p>
        </div>

        <div className="relative max-w-6xl mx-auto">
          {/* Main Carousel Card */}
          <Card className="overflow-hidden shadow-2xl bg-white dark:bg-slate-800 border-0">
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row min-h-[500px]">
                {/* Content Section */}
                <div className="flex-1 p-8 lg:p-12 flex flex-col justify-center">
                  {/* Category Badge */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-3 rounded-full ${categoryConfig[currentItem.category].bgColor}`}>
                      <CategoryIcon className={`h-6 w-6 ${categoryConfig[currentItem.category].color}`} />
                    </div>
                    {currentItem.badge && (
                      <Badge variant="secondary" className="px-3 py-1">
                        {currentItem.badge}
                      </Badge>
                    )}
                  </div>

                  {/* Main Content */}
                  <h3 className="text-3xl lg:text-4xl font-bold mb-3 text-foreground">
                    {currentItem.title}
                  </h3>
                  <p className="text-xl text-muted-foreground mb-6 leading-relaxed">
                    {currentItem.subtitle}
                  </p>
                  <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
                    {currentItem.description}
                  </p>

                  {/* Stats */}
                  {currentItem.stats && (
                    <div className="grid grid-cols-3 gap-6 mb-8">
                      {currentItem.stats.map((stat, index) => (
                        <div key={index} className="text-center">
                          <div className="text-2xl font-bold text-foreground mb-1">
                            {stat.value}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA Button */}
                  <Button asChild size="lg" className="w-fit group">
                    <Link href={currentItem.link}>
                      Explore {currentItem.category === 'legislation' ? 'Legislation' :
                              currentItem.category === 'representatives' ? 'Representatives' : 'Posts'}
                      <ExternalLink className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>

                {/* Visual Section */}
                <div className={`flex-1 ${categoryConfig[currentItem.category].bgColor} flex items-center justify-center p-8 lg:p-12 relative overflow-hidden`}>
                  {/* Decorative Background Pattern */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-20 h-20 rounded-full bg-current"></div>
                    <div className="absolute top-32 right-16 w-12 h-12 rounded-full bg-current"></div>
                    <div className="absolute bottom-20 left-20 w-16 h-16 rounded-full bg-current"></div>
                    <div className="absolute bottom-10 right-10 w-8 h-8 rounded-full bg-current"></div>
                  </div>

                  {/* Category-specific Visual */}
                  <div className="relative z-10 text-center">
                    <CategoryIcon className={`h-32 w-32 mx-auto mb-6 ${categoryConfig[currentItem.category].color}`} />
                    <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
                      {/* Mock UI Elements based on category */}
                      {currentItem.category === 'legislation' && (
                        <>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <FileText className="h-5 w-5 mb-2 text-blue-600" />
                            <div className="text-xs font-medium">Bill Status</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <Calendar className="h-5 w-5 mb-2 text-blue-600" />
                            <div className="text-xs font-medium">Timeline</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <TrendingUp className="h-5 w-5 mb-2 text-blue-600" />
                            <div className="text-xs font-medium">Analytics</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <MessageSquare className="h-5 w-5 mb-2 text-blue-600" />
                            <div className="text-xs font-medium">Summary</div>
                          </div>
                        </>
                      )}
                      {currentItem.category === 'representatives' && (
                        <>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <Users className="h-5 w-5 mb-2 text-green-600" />
                            <div className="text-xs font-medium">Profile</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <MapPin className="h-5 w-5 mb-2 text-green-600" />
                            <div className="text-xs font-medium">District</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <FileText className="h-5 w-5 mb-2 text-green-600" />
                            <div className="text-xs font-medium">Bills</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <TrendingUp className="h-5 w-5 mb-2 text-green-600" />
                            <div className="text-xs font-medium">Voting</div>
                          </div>
                        </>
                      )}
                      {currentItem.category === 'posts' && (
                        <>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <MessageSquare className="h-5 w-5 mb-2 text-purple-600" />
                            <div className="text-xs font-medium">Discuss</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <Users className="h-5 w-5 mb-2 text-purple-600" />
                            <div className="text-xs font-medium">Community</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <TrendingUp className="h-5 w-5 mb-2 text-purple-600" />
                            <div className="text-xs font-medium">Trending</div>
                          </div>
                          <div className="bg-white dark:bg-slate-700 p-3 rounded-lg shadow-sm">
                            <FileText className="h-5 w-5 mb-2 text-purple-600" />
                            <div className="text-xs font-medium">Analysis</div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between mt-8">
            {/* Previous/Next Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Slide Indicators */}
            <div className="flex gap-2">
              {showcaseItems.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-200 ${
                    index === currentIndex
                      ? `${categoryConfig[currentItem.category].accentColor}`
                      : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>

            {/* Auto-play Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="text-xs px-3"
            >
              {isAutoPlaying ? 'Pause' : 'Play'}
            </Button>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex justify-center mt-6 gap-1">
            {Object.entries(categoryConfig).map(([category, config]) => {
              const Icon = config.icon;
              const categoryItems = showcaseItems.filter(item => item.category === category);
              const isActive = categoryItems.some((_, index) =>
                showcaseItems.findIndex(item => item.id === categoryItems[index].id) === currentIndex
              );

              return (
                <Button
                  key={category}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    const firstCategoryIndex = showcaseItems.findIndex(item => item.category === category);
                    goToSlide(firstCategoryIndex);
                  }}
                  className={`capitalize ${isActive ? config.color : ''}`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {category === 'representatives' ? 'Reps' : category}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
