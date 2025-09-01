import type { Metadata } from 'next';

interface BaseMetadata {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  url?: string;
}

interface PageMetadata extends BaseMetadata {
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://statepulse.com';
const defaultImage = `${baseUrl}/images/og-default.png`;

export function generateMetadata({
  title,
  description,
  keywords = [],
  image = defaultImage,
  url,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  section,
}: PageMetadata): Metadata {
  const fullTitle = title.includes('StatePulse') ? title : `${title} | StatePulse`;
  const fullUrl = url ? `${baseUrl}${url}` : baseUrl;

  return {
    title: fullTitle,
    description,
    keywords: [...keywords, 'StatePulse', 'politics', 'legislation', 'representatives', 'civic engagement'].join(', '),
    authors: author ? [{ name: author }] : [{ name: 'StatePulse' }],
    creator: 'StatePulse',
    publisher: 'StatePulse',
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      siteName: 'StatePulse',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: type as any,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(section && { section }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [image],
      creator: '@StatePulse',
      site: '@StatePulse',
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    verification: {
      google: process.env.GOOGLE_VERIFICATION,
    },
  };
}

// Pre-defined metadata for common pages
export const pageMetadata = {
  home: generateMetadata({
    title: 'StatePulse - Stay Informed on U.S. State-Level Developments',
    description: 'Track legislation, follow representatives, and stay engaged with state and federal politics. Get real-time updates on policy changes that affect you.',
    keywords: ['politics', 'legislation', 'state government', 'federal government', 'civic engagement', 'policy tracking'],
    url: '/',
  }),

  representatives: generateMetadata({
    title: 'Representatives - Find Your Elected Officials',
    description: 'Search and filter all state and federal representatives. Find who represents you and track their voting records, positions, and policy stances.',
    keywords: ['representatives', 'elected officials', 'congress', 'state legislature', 'voting records'],
    url: '/representatives',
  }),

  legislation: generateMetadata({
    title: 'Policy Updates - Latest Legislative Developments',
    description: 'Stay updated with the latest policy developments. Filter by category or search for specific topics affecting state and federal legislation.',
    keywords: ['legislation', 'policy updates', 'bills', 'law', 'government policy'],
    url: '/legislation',
  }),

  dashboard: generateMetadata({
    title: 'Dashboard - Comprehensive Visualization of Policy Trends',
    description: 'Interactive map powered analysis for political activity, representatives, trending topics, and district boundaries',
    keywords: ['dashboard', 'political tracking', 'visualization', 'map', 'interactive', 'district boundaries', 'policy trends', 'statepulse'],
    url: '/dashboard',
  }),

  summaries: generateMetadata({
    title: 'AI Summaries - Simplified Policy Analysis',
    description: 'AI-powered summaries of complex legislation and policy documents, making government information accessible and understandable.',
    keywords: ['AI summaries', 'policy analysis', 'legislation summaries', 'government documents'],
    url: '/summaries',
  }),

  about: generateMetadata({
    title: 'About StatePulse - Our Mission for Civic Engagement',
    description: 'Learn about StatePulse\'s mission to make government information accessible and promote civic engagement through technology.',
    keywords: ['about', 'mission', 'civic engagement', 'government transparency'],
    url: '/about',
  }),

  tracker: generateMetadata({
    title: 'Bill Tracker - Follow Legislative Progress',
    description: 'Track the progress of important bills and legislation through the legislative process. Get notified of status changes and votes.',
    keywords: ['bill tracker', 'legislative progress', 'bill status', 'voting tracker'],
    url: '/tracker',
  }),

  civic: generateMetadata({
    title: 'Civic Engagement - Get Involved in Democracy',
    description: 'Tools and resources for civic engagement. Find ways to participate in democracy and make your voice heard.',
    keywords: ['civic engagement', 'democracy', 'political participation', 'citizen involvement'],
    url: '/civic',
  }),

  posts: generateMetadata({
    title: 'Community Posts - Political Discussion',
    description: 'Join the community discussion on political topics, share insights, and engage with other politically active citizens.',
    keywords: ['community', 'political discussion', 'posts', 'civic community'],
    url: '/posts',
  }),

  privacy: generateMetadata({
    title: 'Privacy Policy - How We Protect Your Data',
    description: 'Learn how StatePulse collects, uses, and protects your personal information and political preferences.',
    keywords: ['privacy policy', 'data protection', 'user privacy'],
    url: '/privacy',
  }),

  terms: generateMetadata({
    title: 'Terms of Service - Platform Guidelines',
    description: 'Terms of service and community guidelines for using StatePulse platform and services.',
    keywords: ['terms of service', 'community guidelines', 'platform rules'],
    url: '/terms',
  }),
};

// Dynamic metadata generators for parameterized pages
export function generateRepresentativeMetadata(name: string, title: string, state?: string) {
  return generateMetadata({
    title: `${name} - ${title}${state ? ` (${state})` : ''}`,
    description: `View ${name}'s profile, voting record, policy positions, and latest updates. Track this ${title.toLowerCase()}'s activities and positions on key issues.`,
    keywords: [name, title.toLowerCase(), 'representative profile', 'voting record', state].filter(Boolean),
    url: `/representatives/${name.toLowerCase().replace(/\s+/g, '-')}`,
  });
}

export function generateLegislationMetadata(billTitle: string, billNumber?: string, jurisdiction?: string, summary?: string) {
  return generateMetadata({
    title: `${billNumber ? `${jurisdiction} - ${billNumber} ` : ''}${billTitle}`,
    description: summary || `Details and analysis of ${billTitle}. Track the progress, view voting records, and understand the impact of this legislation.`,
    keywords: ['legislation', 'bill', billNumber, billTitle.toLowerCase(), 'policy', jurisdiction].filter(Boolean),
    type: 'article',
  });
}

export function generatePostMetadata(title: string, excerpt?: string, author?: string, publishedTime?: string) {
  return generateMetadata({
    title,
    description: excerpt || `Community discussion post: ${title}`,
    keywords: ['community post', 'political discussion', 'civic engagement'],
    type: 'article',
    author,
    publishedTime,
    section: 'Community',
  });
}

export function generateUserProfileMetadata(username: string) {
  return generateMetadata({
    title: `${username}'s Profile`,
    description: `View ${username}'s profile, posts, and civic engagement activity on StatePulse.`,
    keywords: ['user profile', 'community member', username],
    url: `/users/${username}`,
  });
}
