"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Share2, Copy, Check, ExternalLink, Share } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  type: 'bill' | 'rep' | 'map';
  id: string;
  title?: string;
  className?: string;
  identifier?: string;
  jurisdiction?: string;
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
    name: 'Bluesky',
    icon: (
      <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 2C16 2 13.5 10.5 8 13C2.5 15.5 2 22 8 25C14 28 16 30 16 30C16 30 18 28 24 25C30 22 29.5 15.5 24 13C18.5 10.5 16 2 16 2Z" fill="#0061FF"/>
      </svg>
    ),
    getUrl: (url: string, text: string) => `https://bsky.app/intent/compose?text=${encodeURIComponent(text + ' ' + url)}`,
    color: 'hover:bg-blue-400 hover:text-white'
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

export function ShareButton({ type, id, title, identifier, jurisdiction, className, variant = 'outline', size = 'sm'}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  // Detect Web Share API support
  const canWebShare = typeof window !== 'undefined' && !!navigator.share;

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
          ? `${jurisdiction} - ${identifier}: ${title}`
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

  const handleWebShare = async () => {
    if (!canWebShare) return;
    try {
      await navigator.share({
        title: title || 'StatePulse',
        text: shareText,
        url: shareUrl,
      });
      toast({
        title: 'Shared!',
        description: 'Content shared via your device.',
      });
      setIsOpen(false);
    } catch (err) {
      // @ts-ignore
      if (err.name !== 'AbortError') {
        toast({
          title: 'Share failed',
          description: 'Could not share via device.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4" />
          {/*<span className="ml-2 hidden sm:inline">Share</span>*/}
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
          {/* Web Share API for mobile */}
          {canWebShare && (
            <Button
              variant="default"
              size="sm"
              className="w-full flex items-center justify-center mb-2"
              onClick={handleWebShare}
            >
              <Share className="h-4 w-4 mr-2" />
              Share via device
            </Button>
          )}
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
          {/*<div className="pt-2 border-t w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>*/}
          {/*  <p className="text-[10px] sm:text-xs text-muted-foreground" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>*/}
          {/*    For Mastodon, you can manually share on your preferred instance by copying the link above.<br />*/}
          {/*    <span className="block mt-2">Instagram does not support direct link sharing. Please copy the link above and share manually in your Instagram bio or story.</span>*/}
          {/*  </p>*/}
          {/*</div>*/}
        </div>
      </DialogContent>
    </Dialog>
  );
}
