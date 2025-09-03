import React from 'react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  src?: string | null;
  alt?: string | null;
  size?: 'post' | 'comment' | 'reply';
  className?: string;
}

export function UserAvatar({ src, alt, size = 'comment', className }: UserAvatarProps) {
  if (!src) {
    return null;
  }

  const sizeClasses = {
    post: 'w-6 h-6 sm:w-8 sm:h-8',
    comment: 'w-5 h-5 sm:w-6 sm:h-6 mt-0.5',
    reply: 'w-4 h-4 sm:w-5 sm:h-5 mt-0.5',
  };

  return (
    <img
      src={src}
      alt={alt || 'User avatar'}
      className={cn('avatar-image', sizeClasses[size], className)}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
    />
  );
}
