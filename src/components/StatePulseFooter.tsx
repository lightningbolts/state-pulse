import { Gavel, ExternalLink, Mail } from "lucide-react";
import Link from "next/link";

export function StatePulseFooter() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-2 sm:px-4 md:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Brand Section */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center gap-2">
              <Gavel className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold font-headline">StatePulse</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Stay informed about state legislation and civic engagement opportunities.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col space-y-2">
            <h3 className="font-medium text-sm">Navigation</h3>
            <div className="flex flex-col space-y-1">
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
              <Link href="/legislation" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Legislation
              </Link>
              <Link href="/tracker" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Policy Tracker
              </Link>
              <Link href="/civic" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Civic Info
              </Link>
            </div>
          </div>

          {/* Legal Links */}
          <div className="flex flex-col space-y-2">
            <h3 className="font-medium text-sm">Legal</h3>
            <div className="flex flex-col space-y-1">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Contact & Social */}
          <div className="flex flex-col space-y-2">
            <h3 className="font-medium text-sm">Connect</h3>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub"
              >
                <ExternalLink className="h-5 w-5" />
              </a>
              <a
                href="mailto:contact@statepulse.com"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-6 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} StatePulse. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with civic engagement in mind.
          </p>
        </div>
      </div>
    </footer>
  );
}
