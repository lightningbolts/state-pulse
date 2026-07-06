"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { ChevronDown, Gavel, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DONATE_URL = "https://buymeacoffee.com/timberlake2025";

type NavLink = { href: string; label: string };

const NAV_GROUPS: Array<
  | { type: "link"; href: string; label: string; shortLabel: string }
  | { type: "group"; label: string; shortLabel: string; items: NavLink[] }
> = [
  { type: "link", href: "/", label: "Home", shortLabel: "Home" },
  {
    type: "group",
    label: "Explore",
    shortLabel: "Explore",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/legislation", label: "Legislation" },
      { href: "/executive-orders", label: "Executive Orders" },
      { href: "/tracker", label: "Tracker" },
    ],
  },
  {
    type: "group",
    label: "People",
    shortLabel: "People",
    items: [
      { href: "/representatives", label: "Representatives" },
      { href: "/civic", label: "Civic Tools" },
    ],
  },
  {
    type: "group",
    label: "Learn",
    shortLabel: "Learn",
    items: [
      { href: "/learn", label: "Overview" },
      { href: "/learn/legislation", label: "What is Legislation?" },
      { href: "/learn/chambers", label: "How Chambers Work" },
      { href: "/learn/faq", label: "FAQ" },
      { href: "/about", label: "About" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupIsActive(pathname: string, items: NavLink[]) {
  return items.some((item) => isActive(pathname, item.href));
}

function NavDropdown({
  label,
  items,
  pathname,
}: {
  label: string;
  items: NavLink[];
  pathname: string;
}) {
  const active = groupIsActive(pathname, items);

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm",
          active
            ? "bg-surface-elevated font-medium text-foreground"
            : "text-secondary hover:bg-hover hover:text-foreground",
        )}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-60 transition-transform group-hover:rotate-180" />
      </button>
      <div
        className={cn(
          "invisible absolute left-0 top-full z-50 min-w-[11rem] border border-border bg-surface-elevated py-1 opacity-0 shadow-lg transition-all",
          "group-hover:visible group-hover:opacity-100",
          "group-focus-within:visible group-focus-within:opacity-100",
        )}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            className={cn(
              "block px-3 py-2 text-sm transition-colors hover:bg-hover",
              isActive(pathname, item.href)
                ? "font-medium text-foreground"
                : "text-secondary",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
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

function DesktopNav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex items-center gap-0.5 lg:gap-1" aria-label="Main">
      {NAV_GROUPS.map((entry) =>
        entry.type === "link" ? (
          <Link
            key={entry.href}
            href={entry.href}
            prefetch
            className={cn(
              "shrink-0 rounded-sm px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm",
              isActive(pathname, entry.href)
                ? "bg-surface-elevated font-medium text-foreground"
                : "text-secondary hover:bg-hover hover:text-foreground",
            )}
          >
            {entry.label}
          </Link>
        ) : (
          <NavDropdown
            key={entry.label}
            label={entry.label}
            items={entry.items}
            pathname={pathname}
          />
        ),
      )}
    </nav>
  );
}

function MobileNav({ pathname }: { pathname: string }) {
  const links = NAV_GROUPS.flatMap((entry) =>
    entry.type === "link"
      ? [{ href: entry.href, label: entry.shortLabel }]
      : entry.items.map((item) => ({ href: item.href, label: item.label })),
  );

  return (
    <nav
      className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label="Main"
    >
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch
          className={cn(
            "shrink-0 rounded-sm px-2 py-1 text-xs",
            isActive(pathname, link.href)
              ? "bg-surface-elevated font-medium text-foreground"
              : "text-secondary hover:bg-hover",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-surface py-2 sm:py-3">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="hidden items-center justify-between gap-4 sm:flex">
          <div className="flex min-w-0 items-center gap-4 lg:gap-6">
            <Link
              href="/"
              prefetch
              className="flex shrink-0 items-center gap-2 text-sm font-semibold text-foreground"
            >
              <Gavel className="h-4 w-4 text-primary" />
              StatePulse
            </Link>
            <DesktopNav pathname={pathname} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <DonateButton />
            <ThemeToggle />
            <AuthControls />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:hidden">
          <div className="flex items-center justify-between gap-2">
            <Link
              href="/"
              prefetch
              className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-foreground"
            >
              <Gavel className="h-4 w-4 text-primary" />
              StatePulse
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <DonateButton />
              <ThemeToggle />
              <AuthControls />
            </div>
          </div>
          <MobileNav pathname={pathname} />
        </div>
      </div>
    </header>
  );
}
