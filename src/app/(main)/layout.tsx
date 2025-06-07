
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StatePulseHeader } from "@/components/StatePulseHeader";
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
  path: string;
  label: string;
  icon: LucideIcon;
}

const menuItems: MenuItem[] = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "updates", path: "/updates", label: "Policy Updates", icon: Newspaper },
  { id: "tracker", path: "/tracker", label: "Track Policies", icon: Eye },
  { id: "timeline", path: "/timeline", label: "Legislation Timeline", icon: GitMerge },
  { id: "summaries", path: "/summaries", label: "AI Summaries", icon: BrainCircuit },
  { id: "civic", path: "/civic", label: "Civic Tools", icon: Users },
];

export default function MainAppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
                <Link href={item.path} passHref legacyBehavior>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.path}
                    tooltip={item.label}
                    className="justify-start"
                  >
                    <a>
                      <item.icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </a>
                  </SidebarMenuButton>
                </Link>
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
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
