"use client";

import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { motion } from "framer-motion";
import {
  BellRing,
  Bot,
  MapPin,
  Vote,
} from "lucide-react";

const FEATURES = [
  {
    title: "AI Legislation Summaries",
    icon: Bot,
    description:
      "Dense statutory language is distilled into plain-English explanations you can scan in seconds. Each bill gets a focused, roughly hundred-word overview of what would change, who is affected, and what happens next—plus optional tweet-length updates when you only have a moment between meetings or on the commute.",
    className:
      "min-h-[280px] lg:col-start-1 lg:row-start-1 lg:col-span-7 lg:row-span-2",
  },
  {
    title: "Representative Connect",
    icon: MapPin,
    description:
      "Find the officials who represent your address or district, then follow them in one place. Open their historical voting records alongside committee assignments and sponsored legislation, and reach out with accurate contact channels—office phone, email, and web form—so advocacy stays grounded in facts, not guesswork.",
    className:
      "min-h-[240px] lg:col-start-8 lg:row-start-1 lg:col-span-5",
  },
  {
    title: "Personalized Civic Alerts",
    icon: BellRing,
    description:
      "Subscribe to the issues, keywords, and bill stages that matter to you. When legislation moves—introduction, committee action, floor votes—or when activity spikes in your districts, you get timely notifications instead of wading through unrelated noise.",
    className:
      "min-h-[240px] lg:col-start-8 lg:row-start-2 lg:col-span-5",
  },
  {
    title: "Interactive Voting Resources",
    icon: Vote,
    description:
      "Compare where candidates stand on the themes you care about, with links to sources and context. Layer in historical election outcomes and turnout where available so you can see patterns, close races, and how your vote fits into broader trends—built to support informed choices, not sound bites.",
    className:
      "min-h-[240px] lg:col-start-1 lg:row-start-3 lg:col-span-12",
  },
] as const;

export default function ImportanceShowcase() {
  return (
    <>
      <AnimatedSection className="py-20 px-6 md:px-10 bg-background text-foreground">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4 tracking-tight">
            Stay Civically Informed
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            StatePulse is dedicated to democratizing access to state and local
            legislation. We believe that every person deserves to understand the
            laws that govern their daily lives, from local zoning ordinances to
            state-wide policy changes. Being aware of civic processes and policy
            decisions lets you advocate for your community, engage meaningfully in
            democracy, and help shape the future of the laws that impact your daily
            life.
          </p>
        </div>
      </AnimatedSection>

      <section className="relative py-16 px-6 md:px-10 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5"
          aria-hidden
        />
        <div className="container relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-12 text-center"
          >
            <h3 className="text-4xl font-bold tracking-tight text-foreground">
              What you can do with StatePulse
            </h3>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              A focused set of tools designed for clarity, speed, and depth when
              the civic stakes are high.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:grid-flow-dense">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.title}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{
                    duration: 0.55,
                    ease: "easeOut",
                    delay: index * 0.08,
                  }}
                  className={`flex flex-col rounded-2xl border border-white/10 bg-card/60 p-8 shadow-xl backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] ${feature.className}`}
                >
                  <div className="mb-6 flex items-start gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-white/10">
                      <Icon className="h-7 w-7" aria-hidden />
                    </span>
                    <h4 className="text-4xl font-bold tracking-tight text-foreground text-left leading-tight">
                      {feature.title}
                    </h4>
                  </div>
                  <p className="text-lg text-muted-foreground leading-relaxed grow text-left">
                    {feature.description}
                  </p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
