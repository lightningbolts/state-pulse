import {SignIn} from "@clerk/nextjs";

export default function AuthPage() {
  return (
      <div className="flex h-full w-full items-center justify-center">
        <SignIn path="/auth" routing="path" signUpUrl="/sign-up" />
      </div>
  );
}