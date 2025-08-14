import { UserProfile } from "@/components/features/UserProfile";
import { generateUserProfileMetadata } from '@/lib/metadata';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { userId: string } }): Promise<Metadata> {
  const { userId } = await params;

  try {
    // You might want to fetch user data here to get the actual username
    // For now, using the userId as fallback
    return generateUserProfileMetadata(userId);
  } catch (error) {
    return {
      title: 'User Profile | StatePulse',
      description: 'View user profile and activity on StatePulse.',
    };
  }
}

export default function UserProfilePage() {
  return <UserProfile />;
}
