const fs = require('fs');
const file = 'd:\\d--alfajer-new\\src\\lib\\admin-notifications.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";',
  'import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";\nimport { useRouter } from "next/navigation";'
);

content = content.replace(
  'export function AdminNotificationProvider({ children }: { children: ReactNode }) {\n  const [notifications, setNotifications] = useState<OrderNotification[]>([]);',
  'export function AdminNotificationProvider({ children }: { children: ReactNode }) {\n  const router = useRouter();\n  const [notifications, setNotifications] = useState<OrderNotification[]>([]);'
);

content = content.replace(
  'window.location.href = `/admin/orders/${notification.id}`;',
  'router.push(`/admin/orders/${notification.id}`);'
);


const startStr = '.subscribe((status, err) => {';
const endStr = '// Start polling as fallback (will be stopped if Realtime works)\n    startPolling();';
const newLogic = `.subscribe((status, err) => {
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
              console.log(\`🔄 Retrying subscription (\${retryCount}/\${maxRetries})...\`);
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
                    ? \`\${shippingAddress.firstName || ""} \${shippingAddress.lastName || ""}\`.trim() || shippingAddress.email || "Guest"
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
                    description: \`Order #\${notification.order_number || notification.id.slice(0, 8)} from \${customerName} - \${formatCurrency(notification.total_amount || 0)}\`,
                    duration: 5000,
                    action: {
                      label: "View",
                      onClick: () => {
                        router.push(\`/admin/orders/\${notification.id}\`);
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
    setupSubscription();`;

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr) + endStr.length;

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Success");
} else {
    console.log("Could not find blocks to replace. Start: ", startIndex, "End:", endIndex);
}
