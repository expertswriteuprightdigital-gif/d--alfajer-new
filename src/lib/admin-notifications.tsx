"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/src/lib/utils";

interface OrderNotification {
  id: string;
  order_number: string | null;
  total_amount: number | null;
  customer_name: string;
  created_at: string;
}

interface NotificationContextType {
  unreadCount: number;
  notifications: OrderNotification[];
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "admin_notifications";
const STORAGE_READ_KEY = "admin_notifications_read";

export function AdminNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const channelRef = useRef<any>(null);
  const originalTitleRef = useRef<string>("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderIdRef = useRef<string | null>(null);

  // Load notifications from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      originalTitleRef.current = document.title;
      
      const saved = localStorage.getItem(STORAGE_KEY);
      const readIds = JSON.parse(localStorage.getItem(STORAGE_READ_KEY) || "[]");
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setNotifications(parsed);
          const unread = parsed.filter((n: OrderNotification) => !readIds.includes(n.id)).length;
          setUnreadCount(unread);
        } catch (e) {
          console.error("Failed to parse saved notifications:", e);
        }
      }
    }
  }, []);

  // Update browser tab title
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) New Orders - Admin Panel`;
    } else {
      document.title = originalTitleRef.current || "Admin Panel";
    }

    // Cleanup on unmount
    return () => {
      document.title = originalTitleRef.current || "Admin Panel";
    };
  }, [unreadCount]);

  // Set up Supabase Realtime subscription for new orders
  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;

    let isSubscribed = false;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const setupSubscription = () => {
      // Create a unique channel name with timestamp to avoid conflicts
      const channelName = `admin-orders-notifications-${Date.now()}`;
      
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: "admin" },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: undefined, // Listen to all inserts
          },
          async (payload) => {
            try {
              const newOrder = payload.new as any;
              
              // Fetch order items to get customer name
              const { data: orderData, error: fetchError } = await supabase
                .from("orders")
                .select(`
                  *,
                  items:order_items(*)
                `)
                .eq("id", newOrder.id)
                .single();

              if (fetchError) {
                console.error("Error fetching order details:", fetchError);
                return;
              }

              if (orderData) {
                const shippingAddress = orderData.shipping_address as {
                  firstName?: string;
                  lastName?: string;
                  email?: string;
                } | null;

                const customerName = shippingAddress
                  ? `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim() || shippingAddress.email || "Guest"
                  : (orderData as { email?: string | null }).email || "Guest";

                const notification: OrderNotification = {
                  id: newOrder.id,
                  order_number: newOrder.order_number,
                  total_amount: newOrder.total_amount || newOrder.total || 0,
                  customer_name: customerName,
                  created_at: newOrder.created_at || new Date().toISOString(),
                };

                // Add to notifications (check for duplicates first)
                setNotifications((prev) => {
                  // Check if notification already exists for this order
                  const exists = prev.some(n => n.id === notification.id);
                  if (exists) {
                    console.log("Notification already exists for order:", notification.id);
                    return prev; // Don't add duplicate
                  }
                  
                  const updated = [notification, ...prev].slice(0, 50); // Keep last 50
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                  
                  // Increment unread count only if it's a new notification
                  setUnreadCount((count) => count + 1);
                  
                  return updated;
                });

                // Show toast notification
                toast.success("New Order Received!", {
                  description: `Order #${notification.order_number || notification.id.slice(0, 8)} from ${customerName} - ${formatCurrency(notification.total_amount || 0)}`,
                  duration: 5000,
                  action: {
                    label: "View",
                    onClick: () => {
                      router.push(`/admin/orders/${notification.id}`);
                    },
                  },
                });
              }
            } catch (error) {
              console.error("Error processing new order notification:", error);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            isSubscribed = true;
            retryCount = 0;
            console.log("✅ Successfully subscribed to orders channel. Realtime notifications active.");
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            isSubscribed = false;
            console.warn("⚠️ Realtime subscription issue:", {
              status,
              error: err,
              retryCount,
            });

            // Retry subscription if not exceeded max retries
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`🔄 Retrying subscription (${retryCount}/${maxRetries})...`);
              setTimeout(() => {
                if (channelRef.current) {
                  supabase.removeChannel(channelRef.current);
                }
                setupSubscription();
              }, retryDelay * retryCount);
            } else {
              console.warn("⚠️ Realtime subscription unavailable. Using polling fallback.");
              console.info("💡 Notifications will work via polling (checks every 10 seconds).");
              startPolling();
            }
          } else {
            console.log("📡 Channel status:", status);
          }
        });

      channelRef.current = channel;
    };

    // Fallback: Polling mechanism if Realtime fails
    const startPolling = () => {
      if (pollingIntervalRef.current) return;
      // Poll every 10 seconds for new orders
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const { data, error } = await supabase
            .from("orders")
            .select("id, order_number, total_amount, shipping_address, email, created_at")
            .order("created_at", { ascending: false })
            .limit(10);

          if (error) {
            console.error("Error polling for new orders:", error);
            return;
          }

          if (data && data.length > 0) {
            const fetchedOrders = [...data].reverse();

            setNotifications((prev) => {
              let updated = [...prev];
              let newCount = 0;

              for (const newOrder of fetchedOrders) {
                if (!updated.some((n) => n.id === newOrder.id)) {
                  const shippingAddress = (newOrder.shipping_address as any) || null;
                  const customerName = shippingAddress
                    ? `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim() || shippingAddress.email || "Guest"
                    : (newOrder.email as string | null | undefined) || "Guest";

                  const notification = {
                    id: newOrder.id,
                    order_number: newOrder.order_number,
                    total_amount: newOrder.total_amount || 0,
                    customer_name: customerName,
                    created_at: newOrder.created_at || new Date().toISOString(),
                  };

                  updated = [notification, ...updated];
                  newCount++;

                  toast.success("New Order Received!", {
                    description: `Order #${notification.order_number || notification.id.slice(0, 8)} from ${customerName} - ${formatCurrency(notification.total_amount || 0)}`,
                    duration: 5000,
                    action: {
                      label: "View",
                      onClick: () => {
                        router.push(`/admin/orders/${notification.id}`);
                      },
                    },
                  });
                }
              }

              if (newCount > 0) {
                updated = updated.slice(0, 50);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                setUnreadCount((count) => count + newCount);
                return updated;
              }

              return prev;
            });
          }
        } catch (error) {
          console.error("Error in polling:", error);
        }
      }, 10000); // Poll every 10 seconds
    };

    // Initial subscription attempt
    setupSubscription();eactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/src/lib/utils";

interface OrderNotification {
  id: string;
  order_number: string | null;
  total_amount: number | null;
  customer_name: string;
  created_at: string;
}

interface NotificationContextType {
  unreadCount: number;
  notifications: OrderNotification[];
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const STORAGE_KEY = "admin_notifications";
const STORAGE_READ_KEY = "admin_notifications_read";

export function AdminNotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = createClient();
  const channelRef = useRef<any>(null);
  const originalTitleRef = useRef<string>("");
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastOrderIdRef = useRef<string | null>(null);

  // Load notifications from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      originalTitleRef.current = document.title;
      
      const saved = localStorage.getItem(STORAGE_KEY);
      const readIds = JSON.parse(localStorage.getItem(STORAGE_READ_KEY) || "[]");
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setNotifications(parsed);
          const unread = parsed.filter((n: OrderNotification) => !readIds.includes(n.id)).length;
          setUnreadCount(unread);
        } catch (e) {
          console.error("Failed to parse saved notifications:", e);
        }
      }
    }
  }, []);

  // Update browser tab title
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (unreadCount > 0) {
      document.title = `(${unreadCount}) New Orders - Admin Panel`;
    } else {
      document.title = originalTitleRef.current || "Admin Panel";
    }

    // Cleanup on unmount
    return () => {
      document.title = originalTitleRef.current || "Admin Panel";
    };
  }, [unreadCount]);

  // Set up Supabase Realtime subscription for new orders
  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;

    let isSubscribed = false;
    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds

    const setupSubscription = () => {
      // Create a unique channel name with timestamp to avoid conflicts
      const channelName = `admin-orders-notifications-${Date.now()}`;
      
      const channel = supabase
        .channel(channelName, {
          config: {
            broadcast: { self: true },
            presence: { key: "admin" },
          },
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: undefined, // Listen to all inserts
          },
          async (payload) => {
            try {
              const newOrder = payload.new as any;
              
              // Fetch order items to get customer name
              const { data: orderData, error: fetchError } = await supabase
                .from("orders")
                .select(`
                  *,
                  items:order_items(*)
                `)
                .eq("id", newOrder.id)
                .single();

              if (fetchError) {
                console.error("Error fetching order details:", fetchError);
                return;
              }

              if (orderData) {
                const shippingAddress = orderData.shipping_address as {
                  firstName?: string;
                  lastName?: string;
                  email?: string;
                } | null;

                const customerName = shippingAddress
                  ? `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim() || shippingAddress.email || "Guest"
                  : (orderData as { email?: string | null }).email || "Guest";

                const notification: OrderNotification = {
                  id: newOrder.id,
                  order_number: newOrder.order_number,
                  total_amount: newOrder.total_amount || newOrder.total || 0,
                  customer_name: customerName,
                  created_at: newOrder.created_at || new Date().toISOString(),
                };

                // Add to notifications (check for duplicates first)
                setNotifications((prev) => {
                  // Check if notification already exists for this order
                  const exists = prev.some(n => n.id === notification.id);
                  if (exists) {
                    console.log("Notification already exists for order:", notification.id);
                    return prev; // Don't add duplicate
                  }
                  
                  const updated = [notification, ...prev].slice(0, 50); // Keep last 50
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
                  
                  // Increment unread count only if it's a new notification
                  setUnreadCount((count) => count + 1);
                  
                  return updated;
                });

                // Show toast notification
                toast.success("New Order Received!", {
                  description: `Order #${notification.order_number || notification.id.slice(0, 8)} from ${customerName} - ${formatCurrency(notification.total_amount || 0)}`,
                  duration: 5000,
                  action: {
                    label: "View",
                    onClick: () => {
                      router.push(`/admin/orders/${notification.id}`);
                    },
                  },
                });
              }
            } catch (error) {
              console.error("Error processing new order notification:", error);
            }
          }
        )
        .subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            isSubscribed = true;
            retryCount = 0;
            console.log("✅ Successfully subscribed to orders channel. Realtime notifications active.");
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            isSubscribed = false;
            console.warn("⚠️ Realtime subscription issue:", {
              status,
              error: err,
              retryCount,
            });

            // Retry subscription if not exceeded max retries
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`🔄 Retrying subscription (${retryCount}/${maxRetries})...`);
              setTimeout(() => {
                if (channelRef.current) {
                  supabase.removeChannel(channelRef.current);
                }
                setupSubscription();
              }, retryDelay * retryCount);
            } else {
              console.warn("⚠️ Realtime subscription unavailable. Using polling fallback.");
              console.info("💡 Notifications will work via polling (checks every 10 seconds).");
            }
          } else {
            console.log("📡 Channel status:", status);
          }
        });

      channelRef.current = channel;
    };

    // Initial subscription attempt
    setupSubscription();

    // Fallback: Polling mechanism if Realtime fails
    const startPolling = () => {
      // Poll every 10 seconds for new orders
      pollingIntervalRef.current = setInterval(async () => {
        try {
          let query = supabase
            .from("orders")
            .select("id, order_number, total_amount, shipping_address, email, created_at")
            .order("created_at", { ascending: false })
            .limit(1);

          // If we have a last order ID, only fetch newer orders
          if (lastOrderIdRef.current) {
            query = query.gt("id", lastOrderIdRef.current);
          }

          const { data, error } = await query;

          if (error) {
            console.error("Error polling for new orders:", error);
            return;
          }

          if (data && data.length > 0) {
            const newOrder = data[0] as any;
            lastOrderIdRef.current = newOrder.id;

            const shippingAddress = (newOrder.shipping_address as {
              firstName?: string;
              lastName?: string;
              email?: string;
            } | null) || null;

            const customerName = shippingAddress
              ? `${shippingAddress.firstName || ""} ${shippingAddress.lastName || ""}`.trim() || shippingAddress.email || "Guest"
              : (newOrder.email as string | null | undefined) || "Guest";

            const notification: OrderNotification = {
              id: newOrder.id,
              order_number: newOrder.order_number,
              total_amount: newOrder.total_amount || 0,
              customer_name: customerName,
              created_at: newOrder.created_at || new Date().toISOString(),
            };

            // Check if notification already exists
            setNotifications((prev) => {
              if (prev.some((n) => n.id === notification.id)) {
                console.log("Notification already exists for order (polling):", notification.id);
                return prev; // Already exists
              }
              const updated = [notification, ...prev].slice(0, 50);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
              
              // Increment unread count only if it's a new notification
              setUnreadCount((count) => count + 1);
              
              return updated;
            });

            toast.success("New Order Received!", {
              description: `Order #${notification.order_number || notification.id.slice(0, 8)} from ${customerName} - ${formatCurrency(notification.total_amount || 0)}`,
              duration: 5000,
              action: {
                label: "View",
                onClick: () => {
                  window.location.href = `/admin/orders/${notification.id}`;
                },
              },
            });
          }
        } catch (error) {
          console.error("Error in polling:", error);
        }
      }, 10000); // Poll every 10 seconds
    };

    // Start polling as fallback (will be stopped if Realtime works)
    startPolling();

    // Cleanup subscription and polling on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [supabase]);

  const markAsRead = (notificationId: string) => {
    const readIds = JSON.parse(localStorage.getItem(STORAGE_READ_KEY) || "[]");
    if (!readIds.includes(notificationId)) {
      readIds.push(notificationId);
      localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(readIds));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(allIds));
    setUnreadCount(0);
  };

  const clearNotifications = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_READ_KEY);
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useAdminNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useAdminNotifications must be used within AdminNotificationProvider");
  }
  return context;
}
