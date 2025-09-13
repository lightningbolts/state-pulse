import { Gavel, ExternalLink, Mail, Github, Instagram } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function StatePulseFooter() {
  const [navOpen, setNavOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  return (
    <footer className="border-t bg-background mt-auto">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-6">
          {/* Brand Section */}
          <div className="flex flex-col items-center md:items-start space-y-3 md:space-y-4 col-span-1 md:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
              <span className="text-base sm:text-lg font-semibold font-headline">
                StatePulse
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Stay informed about state legislation and civic engagement
              opportunities.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col items-start md:items-start">
            <button
              className="flex justify-between items-center w-full md:hidden font-medium text-xs text-foreground mb-2"
              onClick={() => setNavOpen(!navOpen)}
              aria-expanded={navOpen}
            >
              Navigation
              {navOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <h3 className="hidden md:block font-medium text-xs md:text-sm text-foreground mb-2">
              Navigation
            </h3>
            <AnimatePresence initial={false}>
              {navOpen && (
                <motion.ul
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={{
                    open: { height: "auto", transition: { staggerChildren: 0.08, when: "beforeChildren" } },
                    collapsed: { height: 0, transition: { staggerChildren: 0.04, staggerDirection: -1, when: "afterChildren" } }
                  }}
                  style={{ overflow: "hidden" }}
                  className="list-none pl-0 space-y-1 sm:space-y-2"
                >
                  {[
                    { href: "/", label: "Home" },
                    { href: "/dashboard", label: "Dashboard" },
                    { href: "/legislation", label: "Policy Updates" },
                    { href: "/executive-orders", label: "Executive Orders" },
                    { href: "/tracker", label: "Track Policies" },
                    { href: "/representatives", label: "Representatives" },
                    { href: "/posts", label: "Community Posts" },
                    { href: "/summaries", label: "AI Summaries" },
                    { href: "/civic", label: "Civic Tools" }
                  ].map((item, idx) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.08 }}
                    >
                      <Link href={item.href} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">{item.label}</Link>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
            <ul className={`hidden md:block list-none pl-0 space-y-1 md:space-y-2`}>
              <li><Link href="/" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Home</Link></li>
              <li><Link href="/dashboard" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Dashboard</Link></li>
              <li><Link href="/legislation" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Policy Updates</Link></li>
              <li><Link href="/executive-orders" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Executive Orders</Link></li>
              <li><Link href="/tracker" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Track Policies</Link></li>
              <li><Link href="/representatives" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Representatives</Link></li>
              <li><Link href="/posts" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Community Posts</Link></li>
              <li><Link href="/summaries" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">AI Summaries</Link></li>
              <li><Link href="/civic" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Civic Tools</Link></li>
            </ul>
          </div>

          {/* Learn Links */}
          <div className="flex flex-col items-start md:items-start">
            <button
              className="flex justify-between items-center w-full md:hidden font-medium text-xs text-foreground mb-2"
              onClick={() => setLearnOpen(!learnOpen)}
              aria-expanded={learnOpen}
            >
              Learn
              {learnOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <h3 className="hidden md:block font-medium text-xs md:text-sm text-foreground mb-2">
              Learn
            </h3>
            <AnimatePresence initial={false}>
              {learnOpen && (
                <motion.ul
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={{
                    open: { height: "auto", transition: { staggerChildren: 0.08, when: "beforeChildren" } },
                    collapsed: { height: 0, transition: { staggerChildren: 0.04, staggerDirection: -1, when: "afterChildren" } }
                  }}
                  style={{ overflow: "hidden" }}
                  className="list-none pl-0 space-y-1 sm:space-y-2"
                >
                  {[
                    { href: "/learn", label: "Overview" },
                    { href: "/learn/legislation", label: "What is Legislation?" },
                    { href: "/learn/chambers", label: "How Chambers Work" },
                    { href: "/learn/faq", label: "FAQ" }
                  ].map((item, idx) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.08 }}
                    >
                      <Link href={item.href} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">{item.label}</Link>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
            <ul className={`hidden md:block list-none pl-0 space-y-1 md:space-y-2`}>
              <li><Link href="/learn" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Overview</Link></li>
              <li><Link href="/learn/legislation" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">What is Legislation?</Link></li>
              <li><Link href="/learn/chambers" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">How Chambers Work</Link></li>
              <li><Link href="/learn/faq" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="flex flex-col items-start md:items-start">
            <button
              className="flex justify-between items-center w-full md:hidden font-medium text-xs text-foreground mb-2"
              onClick={() => setLegalOpen(!legalOpen)}
              aria-expanded={legalOpen}
            >
              Legal
              {legalOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <h3 className="hidden md:block font-medium text-xs md:text-sm text-foreground mb-2">
              Legal
            </h3>
            <AnimatePresence initial={false}>
              {legalOpen && (
                <motion.ul
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={{
                    open: { height: "auto", transition: { staggerChildren: 0.08, when: "beforeChildren" } },
                    collapsed: { height: 0, transition: { staggerChildren: 0.04, staggerDirection: -1, when: "afterChildren" } }
                  }}
                  style={{ overflow: "hidden" }}
                  className="list-none pl-0 space-y-1 sm:space-y-2"
                >
                  {[
                    { href: "/about", label: "About" },
                    { href: "/privacy", label: "Privacy Policy" },
                    { href: "/terms", label: "Terms of Service" }
                  ].map((item, idx) => (
                    <motion.li
                      key={item.href}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 40 }}
                      transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.08 }}
                    >
                      <Link href={item.href} className="text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">{item.label}</Link>
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
            <ul className={`hidden md:block list-none pl-0 space-y-1 md:space-y-2`}>
              <li><Link href="/about" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">About</Link></li>
              <li><Link href="/privacy" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Privacy Policy</Link></li>
              <li><Link href="/terms" className="text-xs md:text-sm text-muted-foreground hover:text-foreground transition-colors py-1">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Contact & Social */}
          <div className="flex flex-col items-start md:items-start">
            <button
              className="flex justify-between items-center w-full md:hidden font-medium text-xs text-foreground mb-2"
              onClick={() => setConnectOpen(!connectOpen)}
              aria-expanded={connectOpen}
            >
              Connect
              {connectOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            <h3 className="hidden md:block font-medium text-xs md:text-sm text-foreground mb-2">
              Connect
            </h3>
            <AnimatePresence initial={false}>
              {connectOpen && (
                <motion.div
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  variants={{
                    open: { height: "auto", transition: { staggerChildren: 0.08, when: "beforeChildren" } },
                    collapsed: { height: 0, transition: { staggerChildren: 0.04, staggerDirection: -1, when: "afterChildren" } }
                  }}
                  style={{ overflow: "hidden" }}
                  className="flex flex-col items-start space-y-2 sm:space-y-3"
                >
                  <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ duration: 0.5, ease: "easeOut", delay: 0 }}>
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <a href="https://github.com/lightningbolts/state-pulse" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="GitHub"><Github className="h-4 w-4 sm:h-5 sm:w-5" /></a>
                      <a href="https://www.instagram.com/mystatepulse/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Instagram"><Instagram className="h-4 w-4 sm:h-5 sm:w-5" /></a>
                      <a href="mailto:contact@statepulse.me" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Email"><Mail className="h-4 w-4 sm:h-5 sm:w-5" /></a>
                      <a href="https://buymeacoffee.com/timberlake2025" target="_blank" rel="noopener noreferrer" className="bg-yellow-400 text-black font-semibold px-3 py-1 rounded shadow hover:bg-yellow-300 transition-colors text-xs sm:text-sm ml-2" aria-label="Donate">Donate</a>
                    </div>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}>
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      <a href="mailto:contact@statepulse.me" className="hover:text-foreground transition-colors">contact@statepulse.me</a>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className={`hidden md:flex flex-col items-start space-y-2 md:space-y-3`}>
              <div className="flex items-center space-x-3 md:space-x-4">
                <a href="https://github.com/lightningbolts/state-pulse" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="GitHub"><Github className="h-4 w-4 md:h-5 md:w-5" /></a>
                <a href="https://www.instagram.com/mystatepulse/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Instagram"><Instagram className="h-4 w-4 md:h-5 md:w-5" /></a>
                <a href="mailto:contact@statepulse.me" className="text-muted-foreground hover:text-foreground transition-colors p-1" aria-label="Email"><Mail className="h-4 w-4 md:h-5 md:w-5" /></a>
                <a href="https://buymeacoffee.com/timberlake2025" target="_blank" rel="noopener noreferrer" className="bg-yellow-400 text-black font-semibold px-3 py-1 rounded shadow hover:bg-yellow-300 transition-colors text-xs md:text-sm ml-2" aria-label="Donate">Donate</a>
              </div>
              <div className="text-xs md:text-sm text-muted-foreground">
                <a href="mailto:contact@statepulse.me" className="hover:text-foreground transition-colors">contact@statepulse.me</a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t mt-4 md:mt-6 pt-4 md:pt-6 flex flex-col space-y-2 md:space-y-0 md:flex-row md:justify-between md:items-center">
          <p className="text-xs md:text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} StatePulse. All rights reserved.
          </p>
          <p className="text-xs md:text-sm text-muted-foreground text-center md:text-right">
            Built with civic engagement in mind.
          </p>
        </div>
      </div>
    </footer>
  );
}
