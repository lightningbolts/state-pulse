"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Heart, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { useFollowRepresentative } from '@/hooks/use-follow-representative';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  repId: string;
  repName?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'icon';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  showText?: boolean;
  isFollowed?: boolean; // Add this prop to override API calls
}

export function FollowButton({
  repId,
  repName = 'representative',
  variant = 'outline',
  size = 'default',
  className,
  showText = true,
  isFollowed
}: FollowButtonProps) {
  const { isFollowing, isLoading, toggleFollow, isSignedIn } = useFollowRepresentative(repId, isFollowed);

  if (!isSignedIn) {
    return null;
  }

  const buttonText = isFollowing ? 'Following' : 'Follow';
  const Icon = isFollowing ? UserMinus : UserPlus;

  return (
    <Button
      variant={variant}
      size={size}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFollow();
      }}
      disabled={isLoading}
      className={cn(
        isFollowing && "bg-primary/10 text-primary border-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {showText && (
        <span className="ml-2">
          {buttonText}
        </span>
      )}
    </Button>
  );
}
