"use client";

import { useState } from "react";
import { StatePulseHeader } from "@/components/StatePulseHeader";
import { InteractiveMap } from "@/components/features/InteractiveMap";
import { PolicyUpdatesFeed } from "@/components/features/PolicyUpdatesFeed";
import { PolicyTracker } from "@/components/features/PolicyTracker";
import { LegislationTimeline } from "@/components/features/LegislationTimeline";
import { AISummarizationTool } from "@/components/features/AISummarizationTool";
import { RepresentativesFinder } from "@/components/features/RepresentativesFinder";

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Newspaper,
  Eye,
  GitMerge,
  BrainCircuit,
  Users,
  Gavel,
  type LucideIcon,
} from "lucide-react";

type ActiveView =
  | "dashboard"
  | "updates"
  | "tracker"
  | "timeline"
  | "summaries"
  | "civic";

interface MenuItem {
  id: ActiveView;
  label: string;
  icon: LucideIcon;
}

export default function HomePage() {
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");

  const renderContent = () => {
    switch (activeView) {
      case "dashboard":
        return <InteractiveMap />;
      case "updates":
        return <PolicyUpdatesFeed />;
      case "tracker":
        return <PolicyTracker />;
      case "timeline":
        return <LegislationTimeline />;
      case "summaries":
        return <AISummarizationTool />;
      case "civic":
        return <RepresentativesFinder />;
      default:
        return <InteractiveMap />;
    }
  };

  const menuItems: MenuItem[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "updates", label: "Policy Updates", icon: Newspaper },
    { id: "tracker", label: "Track Policies", icon: Eye },
    { id: "timeline", label: "Legislation Timeline", icon: GitMerge },
    { id: "summaries", label: "AI Summaries", icon: BrainCircuit },
    { id: "civic", label: "Civic Tools", icon: Users },
  ];

  return (
    <SidebarProvider defaultOpen>
      <Sidebar>
        <SidebarHeader className="p-4">
          <div className="flex items-center gap-2">
            <Gavel className="h-7 w-7 text-sidebar-primary" />
            <h2 className="text-xl font-semibold font-headline text-sidebar-foreground">
              StatePulse
            </h2>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => setActiveView(item.id)}
                  isActive={activeView === item.id}
                  tooltip={item.label}
                  className="justify-start"
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
          <SidebarSeparator className="my-2" />
          <p className="text-xs text-sidebar-foreground/70 text-center">
            © {new Date().getFullYear()} StatePulse
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <StatePulseHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-background">
          {renderContent()}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
