import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AppNav } from "@/components/layout/AppNav";
import { AppFooter } from "@/components/layout/AppFooter";
import { BookmarksProvider } from "@/components/features/BookmarkButton";

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <AppNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <BookmarksProvider>{children}</BookmarksProvider>
      </main>
      <AppFooter />
    </AppShell>
  );
}
