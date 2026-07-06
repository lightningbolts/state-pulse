import Link from "next/link";
import { Gavel, Github, Instagram, Mail } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/legislation", label: "Policy Updates" },
  { href: "/executive-orders", label: "Executive Orders" },
  { href: "/tracker", label: "Track Policies" },
  { href: "/representatives", label: "Representatives" },
  { href: "/posts", label: "Community Posts" },
  { href: "/summaries", label: "AI Summaries" },
  { href: "/civic", label: "Civic Tools" },
];

const LEARN_LINKS = [
  { href: "/learn", label: "Overview" },
  { href: "/learn/legislation", label: "What is Legislation?" },
  { href: "/learn/chambers", label: "How Chambers Work" },
  { href: "/learn/faq", label: "FAQ" },
];

const LEGAL_LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
];

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-primary" />
              <span className="font-headline text-sm font-semibold">StatePulse</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Stay informed about state legislation and civic engagement.
            </p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground">Navigation</h3>
            <ul className="space-y-1.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground">Learn</h3>
            <ul className="space-y-1.5">
              {LEARN_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground">Legal</h3>
            <ul className="space-y-1.5">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-foreground">Connect</h3>
            <div className="flex items-center gap-3">
              <a href="https://github.com/lightningbolts/state-pulse" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="GitHub">
                <Github className="h-4 w-4" />
              </a>
              <a href="https://www.instagram.com/mystatepulse/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </a>
              <a href="mailto:contact@statepulse.me" className="text-muted-foreground hover:text-foreground" aria-label="Email">
                <Mail className="h-4 w-4" />
              </a>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              <a href="mailto:contact@statepulse.me" className="hover:text-foreground">contact@statepulse.me</a>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} StatePulse. All rights reserved.</p>
          <p>Built with civic engagement in mind.</p>
        </div>
      </div>
    </footer>
  );
}
