import { SignUp } from '@clerk/nextjs';
import { generateMetadata } from '@/lib/metadata';

export const metadata = generateMetadata({
  title: 'Sign Up - Join the StatePulse Community',
  description: 'Create your free StatePulse account to start tracking legislation, following representatives, and engaging in political discussions.',
  keywords: ['sign up', 'register', 'create account', 'join', 'free account'],
  url: '/sign-up',
});

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </div>
  );
}
