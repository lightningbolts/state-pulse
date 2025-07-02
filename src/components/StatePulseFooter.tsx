import { Gavel, ExternalLink, Mail } from "lucide-react";
import Link from "next/link";

export function StatePulseFooter() {
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Brand Section */}
          <div className="flex flex-col space-y-3 sm:space-y-4 col-span-1 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="text-base sm:text-lg font-semibold font-headline">StatePulse</span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Stay informed about state legislation and civic engagement opportunities.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col space-y-2 sm:space-y-3">
            <h3 className="font-medium text-xs sm:text-sm text-foreground">Navigation</h3>
            <div className="flex flex-col space-y-1 sm:space-y-2">
              <Link
                href="/home"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Home
              </Link>
              <Link
                href="/legislation"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Policy Updates
              </Link>
              <Link
                href="/tracker"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Track Policies
              </Link>
              <Link
                href="/posts"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Community Posts
              </Link>
              <Link
                href="/civic"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Civic Tools
              </Link>
            </div>
          </div>

          {/* Legal Links */}
          <div className="flex flex-col space-y-2 sm:space-y-3">
            <h3 className="font-medium text-xs sm:text-sm text-foreground">Legal</h3>
            <div className="flex flex-col space-y-1 sm:space-y-2">
              <Link
                href="/privacy"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Contact & Social */}
          <div className="flex flex-col space-y-2 sm:space-y-3">
            <h3 className="font-medium text-xs sm:text-sm text-foreground">Connect</h3>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="GitHub"
              >
                <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
              <a
                href="mailto:contact@statepulse.com"
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                aria-label="Email"
              >
                <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
              </a>
            </div>
            <div className="text-xs sm:text-sm text-muted-foreground">
              <a
                href="mailto:contact@statepulse.com"
                className="hover:text-foreground transition-colors"
              >
                contact@statepulse.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-4 sm:mt-6 pt-4 sm:pt-6 flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            © {new Date().getFullYear()} StatePulse. All rights reserved.
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-right">
            Built with civic engagement in mind.
          </p>
        </div>
      </div>
    </footer>
  );
}
