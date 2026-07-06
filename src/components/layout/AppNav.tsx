"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { Gavel, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home", shortLabel: "Home" },
  { href: "/dashboard", label: "Dashboard", shortLabel: "Dash" },
  { href: "/legislation", label: "Legislation", shortLabel: "Bills" },
  { href: "/executive-orders", label: "Executive Orders", shortLabel: "EOs" },
  { href: "/tracker", label: "Tracker", shortLabel: "Track" },
  { href: "/representatives", label: "Representatives", shortLabel: "Reps" },
  { href: "/posts", label: "Posts", shortLabel: "Posts" },
  { href: "/civic", label: "Civic Tools", shortLabel: "Civic" },
  { href: "/learn", label: "Learn", shortLabel: "Learn" },
] as const;

const DONATE_URL = "https://buymeacoffee.com/timberlake2025";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          className={cn(
            "shrink-0 rounded-sm px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm",
            isActive(pathname, item.href)
              ? "bg-surface-elevated font-medium text-foreground"
              : "text-secondary hover:bg-hover hover:text-foreground",
          )}
        >
          <span className="sm:hidden">{item.shortLabel}</span>
          <span className="hidden sm:inline">{item.label}</span>
        </Link>
      ))}
    </>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-border px-2 text-xs text-secondary transition-colors hover:bg-hover hover:text-foreground sm:px-2.5"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}

function DonateButton() {
  return (
    <a
      href={DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-8 shrink-0 items-center rounded-sm border border-transparent bg-amber-400 px-2.5 text-xs font-medium text-amber-950 transition-colors hover:bg-amber-300 sm:px-3"
    >
      Donate
    </a>
  );
}

function AuthControls() {
  return (
    <>
      <SignedIn>
        <UserButton afterSignOutUrl="/" />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
            Sign In
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm" className="h-8 px-2 text-xs">
            Sign Up
          </Button>
        </SignUpButton>
      </SignedOut>
    </>
  );
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-surface py-2 sm:py-3">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="hidden items-center justify-between gap-4 sm:flex">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Link href="/" prefetch className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground">
              <Gavel className="h-4 w-4 text-primary" />
              StatePulse
            </Link>
            <nav className="flex items-center gap-0.5 overflow-x-auto lg:gap-1" aria-label="Main">
              <NavLinks pathname={pathname} />
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DonateButton />
            <ThemeToggle />
            <AuthControls />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-center justify-between gap-2">
            <Link href="/" prefetch className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground">
              <Gavel className="h-4 w-4 text-primary" />
              StatePulse
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <DonateButton />
              <ThemeToggle />
              <AuthControls />
            </div>
          </div>
          <nav
            className="-mx-1 flex items-center gap-0.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Main"
          >
            <NavLinks pathname={pathname} />
          </nav>
        </div>
      </div>
    </header>
  );
}
