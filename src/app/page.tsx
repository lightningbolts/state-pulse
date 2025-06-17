import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/home');
  // This return is technically unreachable due to the redirect,
  // but good practice to have a valid return type for a React component.
  return null;
}
