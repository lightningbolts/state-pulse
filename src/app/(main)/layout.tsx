"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StatePulseHeader } from "@/components/StatePulseHeader";
import { BookmarksProvider } from "@/components/features/BookmarkButton";
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
  SidebarAuthAndTheme,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Newspaper,
  Eye,
  BrainCircuit,
  Users,
  Gavel,
  type LucideIcon,
} from "lucide-react";
import {StatePulseFooter} from "@/components/StatePulseFooter";

type ActiveView =
    | "home"
  // | "dashboard"
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
    { id: "home", path: "/home", label: "Home", icon: Gavel },
  // { id: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "updates", path: "/legislation", label: "Policy Updates", icon: Newspaper },
  { id: "tracker", path: "/tracker", label: "Track Policies", icon: Eye },
  { id: "summaries", path: "/summaries", label: "AI Summaries", icon: BrainCircuit },
  { id: "civic", path: "/civic", label: "Civic Tools", icon: Users },
];

function SidebarContentWithAutoClose() {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleMenuItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarContent>
      <SidebarMenu>
        {menuItems.map((item) => (
          <SidebarMenuItem key={item.id}>
            <Link href={item.path} onClick={handleMenuItemClick}>
              <SidebarMenuButton
                isActive={pathname === item.path}
                tooltip={item.label}
                className="justify-start"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarContent>
  );
}

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
        <SidebarContentWithAutoClose />
        <SidebarFooter className="p-4">
          <SidebarAuthAndTheme />
          <SidebarSeparator className="my-2" />
          <p className="text-xs text-sidebar-foreground/70 text-center">
            © {new Date().getFullYear()} StatePulse
          </p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <StatePulseHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6 bg-background">
          <BookmarksProvider>
            {children}
          </BookmarksProvider>
        </main>
        <StatePulseFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
