"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/src/components/admin/sidebar";
import { Navbar } from "@/src/components/admin/navbar";
import { AdminNotificationProvider } from "@/src/lib/admin-notifications";
import { createClient } from "@/src/lib/supabase/client";
import { Loader2 } from "lucide-react";

const ADMIN_EMAILS = ['admin@alfajermart.com', 'admin@alfajer.com', 'tabrezkhanloyola@gmail.com', 'orders.alfajermart@gmail.com'];

function isUserAdmin(user: any): boolean {
  const meta = user?.user_metadata;
  const isAdminMeta = meta?.role === 'admin' || meta?.isAdmin === true || meta?.admin === true;
  const email = user?.email?.toLowerCase();
  const isAdminEmail = email ? ADMIN_EMAILS.includes(email) : false;
  return isAdminMeta || isAdminEmail;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      setIsCheckingAuth(false);
      return;
    }

    const supabase = createClient();

    // Use onAuthStateChange to reliably detect the session
    // This fires with INITIAL_SESSION once the client reads from storage
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[AdminLayout] Auth event:', event, 'Session:', !!session);

        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session && isUserAdmin(session.user)) {
            setIsAuthorized(true);
            setIsCheckingAuth(false);
          } else if (event === 'INITIAL_SESSION' && !session) {
            // No session found at all - redirect to login
            console.log('[AdminLayout] No session found, redirecting to login');
            window.location.href = '/admin/login?redirect=' + encodeURIComponent(pathname || '/admin/dashboard');
          } else if (session && !isUserAdmin(session.user)) {
            // Session exists but user is not admin
            console.log('[AdminLayout] User is not admin, signing out');
            supabase.auth.signOut().then(() => {
              window.location.href = '/admin/login?error=access_denied';
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setIsAuthorized(false);
          window.location.href = '/admin/login';
        }
      }
    );

    // Safety timeout - if no auth event fires within 8 seconds, redirect
    const timeout = setTimeout(() => {
      if (!isAuthorized) {
        console.log('[AdminLayout] Auth check timed out');
        setIsCheckingAuth(false);
        window.location.href = '/admin/login?error=auth_timeout';
      }
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [pathname]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Show loading state while checking auth
  if (isCheckingAuth && pathname !== '/admin/login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Don't render layout for login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Only render admin layout if authorized
  if (!isAuthorized) {
    return null;
  }

  return (
    <AdminNotificationProvider>
      <div className="flex h-screen overflow-hidden relative">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={toggleSidebar}
          isMobileOpen={isMobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />

        <div
          className={`flex flex-1 flex-col transition-all duration-300 min-w-0 w-full relative z-10 ${
            isSidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
          } ml-0`}
        >
          <Navbar onMenuClick={toggleMobileMenu} />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-3 sm:p-4 md:p-6 lg:p-8 w-full max-w-full">
            <div className="w-full max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AdminNotificationProvider>
  );
}
