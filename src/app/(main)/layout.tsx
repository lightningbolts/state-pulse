"use client"
import { Gavel, LayoutDashboard, Newspaper, Eye, Users, MessageSquare, BrainCircuit, Wrench } from "lucide-react";
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
import {StatePulseFooter} from "@/components/StatePulseFooter";

type ActiveView =
    | "home"
    | "dashboard"
    | "updates"
    | "tracker"
    | "representatives"
    | "posts"
    | "timeline"
    | "civic";

interface MenuItem {
  id: ActiveView;
  path: string;
  label: string;
  icon: LucideIcon;
}

const menuItems: MenuItem[] = [
    { id: "home", path: "/", label: "Home", icon: Gavel },
    { id: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "updates", path: "/legislation", label: "Policy Updates", icon: Newspaper },
    { id: "tracker", path: "/tracker", label: "Track Policies", icon: Eye },
    { id: "representatives", path: "/representatives", label: "Representatives", icon: Users },
    { id: "posts", path: "/posts", label: "Community Posts", icon: MessageSquare },
    // { id: "summaries", path: "/summaries", label: "AI Summaries", icon: BrainCircuit },
    { id: "civic", path: "/civic", label: "Civic Tools", icon: Wrench },
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
        <SidebarFooter className="p-4 flex flex-col gap-3">
          <div className="flex flex-row items-center w-full gap-2 mb-2">
            <SidebarAuthAndTheme />
            <a
              href="https://buymeacoffee.com/timberlake2025"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
              style={{ minWidth: 0 }}
            >
              <button
                className="h-10 w-full bg-yellow-400 text-black font-semibold px-3 rounded-lg shadow hover:bg-yellow-300 transition-colors text-sm flex items-center justify-center gap-1"
                style={{ minWidth: 0 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 01.75-.75h9a.75.75 0 01.75.75v6a2.25 2.25 0 01-2.25 2.25h-6A2.25 2.25 0 016.75 18v-6z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75v6.75" />
                </svg>
                Donate
              </button>
            </a>
          </div>
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
