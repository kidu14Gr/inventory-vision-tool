import { Bell, User } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Stock</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs bg-destructive text-destructive-foreground">
            99+
          </Badge>
        </Button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-company-primary flex items-center justify-center">
            <span className="text-white text-sm font-medium">S</span>
          </div>
          <span className="text-sm font-medium">Samuel.N</span>
        </div>
      </div>
    </header>
  );
}