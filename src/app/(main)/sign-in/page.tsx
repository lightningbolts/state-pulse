import { SignIn } from '@clerk/nextjs';
import { generateMetadata } from '@/lib/metadata';

export const metadata = generateMetadata({
  title: 'Sign In - Access Your StatePulse Account',
  description: 'Sign in to your StatePulse account to track legislation, follow representatives, and engage with the political community.',
  keywords: ['sign in', 'login', 'account access', 'authentication'],
  url: '/sign-in',
});

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn path="/signin" routing="path" signUpUrl="/signup" />
    </div>
  );
}
