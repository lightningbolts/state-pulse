"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Share2, Copy, Check, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  type: 'bill' | 'rep' | 'map';
  id: string;
  title?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

interface SharePlatform {
  name: string;
  icon: React.ReactNode;
  getUrl: (url: string, text: string) => string;
  color: string;
}

const sharePlatforms: SharePlatform[] = [
  {
    name: 'Twitter/X',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 1200 1227">
        <path d="M714.163 519.284 1160.89 0h-105.86L667.137 450.887 357.328 0H0l468.492 681.821L0 1226.37h105.866l409.625-476.152 327.181 476.152H1200L714.137 519.284h.026ZM569.165 687.828l-47.468-67.894-377.686-540.24h162.604l304.797 435.991 47.468 67.894 396.2 566.721H892.476L569.165 687.854v-.026Z"/>
      </svg>
    ),
    getUrl: (url: string, text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    color: 'hover:bg-black hover:text-white'
  },
  {
    name: 'LinkedIn',
    icon: (
      <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" viewBox="0 0 256 256">
        <path d="M218.123 218.127h-37.931v-59.403c0-14.165-.253-32.4-19.728-32.4-19.756 0-22.779 15.434-22.779 31.369v60.43h-37.93V95.967h36.413v16.694h.51a39.907 39.907 0 0 1 35.928-19.733c38.445 0 45.533 25.288 45.533 58.186l-.016 67.013ZM56.955 79.27c-12.157.002-22.014-9.852-22.016-22.009-.002-12.157 9.851-22.014 22.008-22.016 12.157-.003 22.014 9.851 22.016 22.008A22.013 22.013 0 0 1 56.955 79.27m18.966 138.858H37.95V95.967h37.97v122.16ZM237.033.018H18.89C8.58-.098.125 8.161-.001 18.471v219.053c.122 10.315 8.576 18.582 18.89 18.474h218.144c10.336.128 18.823-8.139 18.966-18.474V18.454c-.147-10.33-8.635-18.588-18.966-18.453" fill="#0A66C2"/>
      </svg>
    ),
    getUrl: (url: string, text: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    color: 'hover:bg-blue-600 hover:text-white'
  },
  {
    name: 'Facebook',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="16" height="16">
        <defs>
          <linearGradient x1="50%" x2="50%" y1="97.078%" y2="0%" id="facebook-a">
            <stop offset="0%" stopColor="#0062E0"/>
            <stop offset="100%" stopColor="#19AFFF"/>
          </linearGradient>
        </defs>
        <path fill="url(#facebook-a)" d="M15 35.8C6.5 34.3 0 26.9 0 18 0 8.1 8.1 0 18 0s18 8.1 18 18c0 8.9-6.5 16.3-15 17.8l-1-.8h-4l-1 .8z"/>
        <path fill="#FFF" d="m25 23 .8-5H21v-3.5c0-1.4.5-2.5 2.7-2.5H26V7.4c-1.3-.2-2.7-.4-4-.4-4.1 0-7 2.5-7 7v4h-4.5v5H15v12.7c1 .2 2 .3 3 .3s2-.1 3-.3V23h4z"/>
      </svg>
    ),
    getUrl: (url: string, text: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    color: 'hover:bg-blue-500 hover:text-white'
  },
  {
    name: 'Instagram',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" preserveAspectRatio="xMidYMid" viewBox="0 0 256 256">
        <path fill="currentColor" d="M128 23.064c34.177 0 38.225.13 51.722.745 12.48.57 19.258 2.655 23.769 4.408 5.974 2.322 10.238 5.096 14.717 9.575 4.48 4.479 7.253 8.743 9.575 14.717 1.753 4.511 3.838 11.289 4.408 23.768.615 13.498.745 17.546.745 51.723 0 34.178-.13 38.226-.745 51.723-.57 12.48-2.655 19.257-4.408 23.768-2.322 5.974-5.096 10.239-9.575 14.718-4.479 4.479-8.743 7.253-14.717 9.574-4.511 1.753-11.289 3.839-23.769 4.408-13.495.616-17.543.746-51.722.746-34.18 0-38.228-.13-51.723-.746-12.48-.57-19.257-2.655-23.768-4.408-5.974-2.321-10.239-5.095-14.718-9.574-4.479-4.48-7.253-8.744-9.574-14.718-1.753-4.51-3.839-11.288-4.408-23.768-.616-13.497-.746-17.545-.746-51.723 0-34.177.13-38.225.746-51.722.57-12.48 2.655-19.258 4.408-23.769 2.321-5.974 5.095-10.238 9.574-14.717 4.48-4.48 8.744-7.253 14.718-9.575 4.51-1.753 11.288-3.838 23.768-4.408 13.497-.615 17.545-.745 51.723-.745M128 0C93.237 0 88.878.147 75.226.77c-13.625.622-22.93 2.786-31.071 5.95-8.418 3.271-15.556 7.648-22.672 14.764C14.367 28.6 9.991 35.738 6.72 44.155 3.555 52.297 1.392 61.602.77 75.226.147 88.878 0 93.237 0 128c0 34.763.147 39.122.77 52.774.622 13.625 2.785 22.93 5.95 31.071 3.27 8.417 7.647 15.556 14.763 22.672 7.116 7.116 14.254 11.492 22.672 14.763 8.142 3.165 17.446 5.328 31.07 5.95 13.653.623 18.012.77 52.775.77s39.122-.147 52.774-.77c13.624-.622 22.929-2.785 31.07-5.95 8.418-3.27 15.556-7.647 22.672-14.763 7.116-7.116 11.493-14.254 14.764-22.672 3.164-8.142 5.328-17.446 5.95-31.07.623-13.653.77-18.012.77-52.775s-.147-39.122-.77-52.774c-.622-13.624-2.786-22.929-5.95-31.07-3.271-8.418-7.648-15.556-14.764-22.672C227.4 14.368 220.262 9.99 211.845 6.72c-8.142-3.164-17.447-5.328-31.071-5.95C167.122.147 162.763 0 128 0Zm0 62.27C91.698 62.27 62.27 91.7 62.27 128c0 36.302 29.428 65.73 65.73 65.73 36.301 0 65.73-29.428 65.73-65.73 0-36.301-29.429-65.73-65.73-65.73Zm0 108.397c-23.564 0-42.667-19.103-42.667-42.667S104.436 85.333 128 85.333s42.667 19.103 42.667 42.667-19.103 42.667-42.667 42.667Zm83.686-110.994c0 8.484-6.876 15.36-15.36 15.36-8.483 0-15.36-6.876-15.36-15.36 0-8.483 6.877-15.36 15.36-15.36 8.484 0 15.36 6.877 15.36 15.36Z"/>
      </svg>
    ),
    getUrl: (url: string, text: string) => `https://www.instagram.com/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    color: 'hover:bg-red-600 hover:text-white'
  },
  {
    name: 'Reddit',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    ),
    getUrl: (url: string, text: string) => `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
    color: 'hover:bg-orange-600 hover:text-white'
  },
];

export function ShareButton({ type, id, title, className, variant = 'outline', size = 'sm' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Generate the shareable URL
  const getShareableUrl = () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://statepulse.me';

    if (type === 'bill') {
      return `${baseUrl}/legislation/${id}`;
    } else if (type === 'rep') {
      return `${baseUrl}/representatives/${id}`;
    } else if (type === 'map') {
      const params = new URLSearchParams();
      params.set('map', id);
      return `${baseUrl}/dashboard?${params.toString()}`;
    }

    return baseUrl;
  };

  // Generate share text based on type
  const getShareText = () => {
    switch (type) {
      case 'bill':
        return title 
          ? `Track ${title} on StatePulse`
          : `Track this legislation on StatePulse`;
      case 'rep':
        return title 
          ? `See ${title}'s profile on StatePulse`
          : `See this representative's profile on StatePulse`;
      case 'map':
        return title 
          ? `Explore ${title}'s legislation and representatives on StatePulse`
          : `Explore this area's legislation and representatives on StatePulse`;
      default:
        return 'Check this out on StatePulse';
    }
  };

  const shareUrl = getShareableUrl();
  const shareText = getShareText();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The shareable link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
      toast({
        title: "Copy failed",
        description: "Failed to copy the link. Please try again.",
        variant: "destructive",
      });
    }
  };

  const openShareUrl = (platform: SharePlatform) => {
    const url = platform.getUrl(shareUrl, shareText);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Share</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="w-full max-w-[95vw] sm:max-w-md px-2 py-4 sm:p-6 rounded-xl overflow-x-auto"
        style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
      >
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Share this content</DialogTitle>
        </DialogHeader>
  <div className="space-y-4 w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
          {/* Share text preview */}
          <div className="p-2 sm:p-3 bg-muted rounded-lg w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
            <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>Share text:</p>
            <p className="text-xs sm:text-sm font-medium break-all" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{shareText}</p>
          </div>

          {/* Copy link button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
            <div
              className="p-2 bg-muted rounded text-xs sm:text-sm font-mono w-full"
              style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
            >
              {shareUrl}
            </div>
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Social media platforms */}
          <div className="space-y-2 w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
            <p className="text-xs sm:text-sm font-medium" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>Share on:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
              {sharePlatforms.map((platform) => (
                <Button
                  key={platform.name}
                  variant="outline"
                  onClick={() => openShareUrl(platform)}
                  className={`justify-start items-center py-2 text-xs sm:text-sm ${platform.color} transition-colors w-full`}
                  style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', minWidth: 0, whiteSpace: 'normal' }}
                >
                  <span className="mr-2 flex-shrink-0">{platform.icon}</span>
                  <span className="flex-grow min-w-0" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>{platform.name}</span>
                  <ExternalLink className="ml-auto h-3 w-3 flex-shrink-0" />
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Mastodon instance */}
          <div className="pt-2 border-t w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
            <p className="text-[10px] sm:text-xs text-muted-foreground" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
              For Mastodon, you can manually share on your preferred instance by copying the link above.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
