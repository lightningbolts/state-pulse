import React from 'react';
import RepresentativeCard from './RepresentativeCard';
import { Representative } from '@/types/representative';

interface FollowedLegislatorsTabProps {
  followedReps: Representative[];
  loading: boolean;
  isSignedIn: boolean;
  onFollowChange?: () => void;
}

export default function FollowedLegislatorsTab({ followedReps, loading, isSignedIn, onFollowChange }: FollowedLegislatorsTabProps) {
  if (!isSignedIn) return <div className="p-4">Sign in to see your followed legislators.</div>;
  if (loading) return <div className="p-4">Loading...</div>;
  if (!followedReps || followedReps.length === 0) return <div className="p-4">You are not following any legislators yet.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {followedReps.filter(rep => rep && rep.id).map(rep => (
        <RepresentativeCard 
          key={rep.id} 
          rep={rep} 
          isFollowed={true} 
          onFollowChange={onFollowChange}
        />
      ))}
    </div>
  );
}
