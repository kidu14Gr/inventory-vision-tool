import { 
  Home, 
  FolderOpen, 
  Lightbulb, 
  Building, 
  Truck,
  DollarSign,
  MapPin,
  FileText,
  Package,
  BarChart3,
  Settings,
  Brain,
  TrendingUp
} from "lucide-react";
import { NavLink } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainMenuItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Project", url: "/project", icon: FolderOpen },
  { title: "Solutions", url: "/solutions", icon: Lightbulb },
  { title: "Supplier", url: "/supplier", icon: Building },
  { title: "Sourcing", url: "/sourcing", icon: Truck },
  { title: "Finance", url: "/finance", icon: DollarSign },
  { title: "Logistics", url: "/logistics", icon: MapPin },
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

const intelligenceItems = [
  { title: "AI Predictions", url: "/ai-predictions", icon: Brain },
  { title: "Demand Forecast", url: "/demand-forecast", icon: TrendingUp },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const getNavClassName = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
      isActive 
        ? "bg-company-primary text-company-primary-foreground" 
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

  return (
    <Sidebar className={`${collapsed ? "w-14" : "w-60"} bg-company-primary`}>
      <SidebarContent className="bg-company-primary">
        {/* Logo Section */}
        <div className="p-4 border-b border-company-secondary">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span className="text-company-primary font-bold text-sm">SCM</span>
            </div>
            {!collapsed && (
              <div className="text-white">
                <div className="text-sm font-medium">SCM</div>
                <div className="text-xs opacity-80">Supply Chain</div>
              </div>
            )}
          </div>
        </div>

        {/* Main Menu */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/80 text-xs uppercase tracking-wider px-4 py-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClassName}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* AI Intelligence Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/80 text-xs uppercase tracking-wider px-4 py-2">
            AI Intelligence
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {intelligenceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClassName}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <div className="mt-auto p-4">
          <SidebarMenuButton asChild>
            <NavLink to="/settings" className={getNavClassName}>
              <Settings className="h-4 w-4" />
              {!collapsed && <span className="text-sm">Settings</span>}
            </NavLink>
          </SidebarMenuButton>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}