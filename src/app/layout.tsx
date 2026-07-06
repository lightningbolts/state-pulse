import type {Metadata, Viewport} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider, SignedIn } from '@clerk/nextjs';
import { DM_Sans, JetBrains_Mono, Source_Serif_4 } from 'next/font/google';
import { UserSyncComponent } from '@/components/auth/UserSyncComponent';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ScrollRestoration } from '@/components/providers/ScrollRestoration';
import React, { Suspense } from "react";

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StatePulse',
  description: 'Stay informed on U.S. state-level developments.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
            }}
          />
        </head>
        <body className={`${dmSans.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-body antialiased min-h-dvh w-full`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <QueryProvider>
              <SignedIn>
                <UserSyncComponent />
              </SignedIn>
              <Suspense fallback={null}>
                <ScrollRestoration />
              </Suspense>
              {children}
              <Toaster />
              <SpeedInsights />
              <Analytics />
            </QueryProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
