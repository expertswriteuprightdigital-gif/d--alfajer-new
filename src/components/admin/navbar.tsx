"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { gsap } from "gsap";
import { Search, Bell, User, Moon, Sun, Menu, Check, X, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Badge } from "@/src/components/ui/badge";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import { useAdminNotifications } from "@/src/lib/admin-notifications";
import { formatCurrency } from "@/src/lib/utils";
import { createClient } from "@/src/lib/supabase/client";
import { toast } from "sonner";
import Link from "next/link";

// Simple time ago formatter
const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

interface NavbarProps {
  onMenuClick?: () => void;
}

export const Navbar = ({ onMenuClick }: NavbarProps) => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("admin@example.com");
  const [userName, setUserName] = useState<string>("Admin User");
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useAdminNotifications();
  const navbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setMounted(true);
    
    // Get current user info
    const getUserInfo = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || "admin@example.com");
          setUserName(user.user_metadata?.name || user.email?.split("@")[0] || "Admin User");
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };
    
    getUserInfo();
  }, []);

  useEffect(() => {
    if (navbarRef.current) {
      gsap.fromTo(
        navbarRef.current,
        { y: -100, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          ease: "power3.out",
        }
      );
    }
  }, []);

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <header
      ref={navbarRef}
      className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6 lg:px-8"
    >
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onMenuClick();
          }}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      <div className="flex flex-1 items-center gap-2 sm:gap-4 min-w-0">
        <div className="relative flex-1 max-w-full sm:max-w-md w-full">
          <Search className="absolute left-2 sm:left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-8 sm:pl-9 text-sm sm:text-base h-9 sm:h-10 w-full"
          />
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-1 sm:gap-2">
        {/* Theme Toggle - Hidden on mobile, shown in sidebar */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleThemeToggle}
          aria-label="Toggle theme"
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          {mounted && theme === "dark" ? (
            <Sun className="h-4 w-4 sm:h-5 sm:w-5" />
          ) : (
            <Moon className="h-4 w-4 sm:h-5 sm:w-5" />
          )}
        </Button>

        {/* Notifications - Hidden on mobile, shown in sidebar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10" aria-label="Notifications">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-0.5 -top-0.5 sm:-right-1 sm:-top-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full p-0 flex items-center justify-center text-[10px] sm:text-xs font-bold"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[calc(100vw-2rem)] sm:w-80">
            <div className="flex items-center justify-between px-2 py-1.5">
              <DropdownMenuLabel className="px-0">Notifications</DropdownMenuLabel>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                  className="h-7 text-xs"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => {
                  const readIds = JSON.parse(localStorage.getItem("admin_notifications_read") || "[]");
                  const isRead = readIds.includes(notification.id);
                  const timeAgo = formatTimeAgo(notification.created_at);
                  
                  return (
                    <DropdownMenuItem
                      key={notification.id}
                      className={`flex flex-col items-start gap-1 py-3 cursor-pointer ${!isRead ? "bg-muted/50" : ""}`}
                      onClick={() => {
                        markAsRead(notification.id);
                        router.push(`/admin/orders/${notification.id}`);
                      }}
                    >
                      <div className="flex items-start justify-between w-full gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">New order received</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Order #{notification.order_number || notification.id.slice(0, 8)} from {notification.customer_name}
                          </p>
                          <p className="text-xs text-muted-foreground font-semibold mt-1">
                            {formatCurrency(notification.total_amount || 0)}
                          </p>
                          <span className="text-xs text-muted-foreground">{timeAgo}</span>
                        </div>
                        {!isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                        )}
                      </div>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="justify-center">
                  <Link href="/admin/orders">View all orders</Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profile Dropdown - Hidden on mobile, shown in sidebar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full" aria-label="User menu">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                <AvatarFallback className="text-xs sm:text-sm">AD</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/admin/settings/store">
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                try {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  toast.success("Logged out successfully");
                  router.push("/admin/login");
                } catch (error) {
                  console.error("Logout error:", error);
                  toast.error("Failed to log out");
                }
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
