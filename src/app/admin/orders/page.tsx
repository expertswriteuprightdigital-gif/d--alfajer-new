"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Eye, Loader2, Filter, Download, RefreshCw, Truck, Package, CheckSquare, Square } from "lucide-react";
import { DataTable } from "@/src/components/admin/data-table";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { formatCurrency } from "@/src/lib/utils";
import { getAllOrders, updateOrderStatus, type OrderWithItems } from "@/src/lib/supabase/orders";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { toast } from "sonner";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { ScrollArea } from "@/src/components/ui/scroll-area";

// Status badge helper
const getStatusBadge = (status: string | null) => {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    pending: "outline",
    processing: "default",
    shipped: "secondary",
    delivered: "default",
    cancelled: "destructive",
  };

  return (
    <Badge variant={variants[status || "pending"] || "outline"} className="capitalize">
      {status || "pending"}
    </Badge>
  );
};

// Date formatter helper
const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// Helper to escape CSV fields
const escapeCSV = (field: any) => {
  if (field === null || field === undefined) return '';
  const stringField = String(field);
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

function OrdersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get("status") || "all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Bulk selection state
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showBulkShipmentModal, setShowBulkShipmentModal] = useState(false);
  const [bulkShipmentProgress, setBulkShipmentProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
    processing: boolean;
    results: Array<{ orderId: string; orderNumber: string; success: boolean; message: string }>;
  }>({ total: 0, completed: 0, failed: 0, processing: false, results: [] });
  const [shiprocketConfig, setShiprocketConfig] = useState<any>(null);

  // Load Shiprocket config on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shiprocket_config");
      if (saved) {
        try {
          setShiprocketConfig(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse shiprocket config:", e);
        }
      }
    }
  }, []);

  // Fetch orders from Supabase
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getAllOrders({ status: statusFilter });
      // Orders are already sorted by created_at descending in the database query
      // Additional client-side sort ensures proper ordering even if database sort fails
      const sortedData = [...data].sort((a, b) => {
        const dateA = new Date(a.created_at || a.updated_at || 0).getTime();
        const dateB = new Date(b.created_at || b.updated_at || 0).getTime();
        return dateB - dateA; // Newest first
      });
      setOrders(sortedData);
      setSelectedOrders(new Set()); // Clear selection on refresh
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  // Refresh orders when page becomes visible (handles new orders)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [statusFilter]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    const success = await updateOrderStatus(orderId, newStatus);

    if (success) {
      setOrders(orders.map(order =>
        order.id === orderId ? { ...order, status: newStatus } : order
      ));
      toast.success("Order status updated");
    } else {
      toast.error("Failed to update status");
    }

    setUpdatingStatus(null);
  };

  const getCustomerName = (order: OrderWithItems) => {
    const address = order.shipping_address as { firstName?: string; lastName?: string; email?: string } | null;
    if (address?.firstName || address?.lastName) {
      return `${address.firstName || ""} ${address.lastName || ""}`.trim();
    }
    return address?.email || "Guest";
  };

  const getCustomerEmail = (order: OrderWithItems) => {
    const address = order.shipping_address as { email?: string } | null;
    return address?.email || "";
  };

  const handleExportCSV = () => {
    if (orders.length === 0) {
      toast.error("No orders to export");
      return;
    }

    const headers = ["Order ID", "Date", "Customer Name", "Email", "Total", "Status", "Items Count"];
    const csvContent = [
      headers.join(','),
      ...orders.map(order => {
        const name = getCustomerName(order);
        const email = getCustomerEmail(order);
        return [
          escapeCSV(order.id),
          escapeCSV(new Date(order.created_at || '').toLocaleDateString()),
          escapeCSV(name),
          escapeCSV(email),
          escapeCSV(order.total_amount || order.total || 0),
          escapeCSV(order.status),
          escapeCSV(order.items?.length || 0)
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  // Select all pending/processing orders (shippable)
  const selectAllShippable = () => {
    const shippable = orders.filter(o =>
      (o.status === "pending" || o.status === "processing") &&
      o.payment_status === "paid" &&
      !o.tracking_number
    );
    setSelectedOrders(new Set(shippable.map(o => o.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  // Create bulk shipments
  const handleBulkShipment = async () => {
    if (!shiprocketConfig?.token) {
      toast.error("Please configure Shiprocket settings first");
      return;
    }

    const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));

    // Filter only shippable orders
    const shippableOrders = selectedOrdersList.filter(o =>
      (o.status === "pending" || o.status === "processing") &&
      !o.tracking_number
    );

    if (shippableOrders.length === 0) {
      toast.error("No shippable orders selected. Orders must be pending/processing and not already shipped.");
      return;
    }

    setBulkShipmentProgress({
      total: shippableOrders.length,
      completed: 0,
      failed: 0,
      processing: true,
      results: [],
    });
    setShowBulkShipmentModal(true);

    // Process orders sequentially to avoid rate limiting
    for (const order of shippableOrders) {
      try {
        const shippingAddress = order.shipping_address as any;
        if (!shippingAddress?.postalCode && !shippingAddress?.zip) {
          setBulkShipmentProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            failed: prev.failed + 1,
            results: [...prev.results, {
              orderId: order.id,
              orderNumber: order.order_number || order.id.slice(0, 8),
              success: false,
              message: "Missing pincode"
            }],
          }));
          continue;
        }

        const orderItems = order.items || [];
        if (orderItems.length === 0) {
          setBulkShipmentProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            failed: prev.failed + 1,
            results: [...prev.results, {
              orderId: order.id,
              orderNumber: order.order_number || order.id.slice(0, 8),
              success: false,
              message: "No items in order"
            }],
          }));
          continue;
        }

        // Prepare shipment data
        const addressLine = shippingAddress.address || shippingAddress.streetAddress || "";
        const postalCode = shippingAddress.zip || shippingAddress.postalCode || "";
        const customerEmail = shippingAddress.email || order.email || "";

        if (!customerEmail) {
          setBulkShipmentProgress(prev => ({
            ...prev,
            completed: prev.completed + 1,
            failed: prev.failed + 1,
            results: [...prev.results, {
              orderId: order.id,
              orderNumber: order.order_number || order.id.slice(0, 8),
              success: false,
              message: "Missing customer email"
            }],
          }));
          continue;
        }

        const shiprocketItems = orderItems.map((item: any) => ({
          name: item.name || "Product",
          sku: item.sku || item.product_id || "SKU001",
          units: item.quantity || 1,
          selling_price: Number(item.price) || 0,
        }));

        const totalWeight = orderItems.reduce((sum: number, item: any) => {
          return sum + (item.weight || 0.5) * (item.quantity || 1);
        }, 0) || 0.5;

        const shipmentData = {
          order_id: order.order_number || order.id,
          order_date: new Date(order.created_at || Date.now()).toISOString().split('T')[0],
          pickup_location: shiprocketConfig.pickupLocation || "Primary",
          billing_customer_name: shippingAddress.firstName || "",
          billing_last_name: shippingAddress.lastName || "",
          billing_address: addressLine,
          billing_city: shippingAddress.city || "",
          billing_pincode: postalCode,
          billing_state: shippingAddress.state || "",
          billing_country: shippingAddress.country || "India",
          billing_email: customerEmail,
          billing_phone: shippingAddress.phone || "",
          shipping_is_billing: true,
          shipping_email: customerEmail,
          order_items: shiprocketItems,
          payment_method: order.payment_method === "cod" ? "COD" : "Prepaid",
          sub_total: Number(order.subtotal) || 0,
          weight: totalWeight,
          length: 20,
          breadth: 15,
          height: 10,
        };

        // Create shipment (auto-assigns cheapest courier)
        const response = await fetch("/api/shiprocket/shipment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: shiprocketConfig.token,
            shipmentData,
            // Don't specify courier_id to let Shiprocket auto-assign cheapest
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || result.message || "Failed to create shipment");
        }

        const awbCode = result.awb_code || result.payload?.awb_code;
        const shipmentId = result.shipment_id || result.payload?.shipment_id;

        setBulkShipmentProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          results: [...prev.results, {
            orderId: order.id,
            orderNumber: order.order_number || order.id.slice(0, 8),
            success: true,
            message: awbCode ? `AWB: ${awbCode}` : `Shipment ID: ${shipmentId}`
          }],
        }));

        // Update local state
        setOrders(prev => prev.map(o =>
          o.id === order.id
            ? { ...o, status: awbCode ? "shipped" : "processing", tracking_number: awbCode || `SR-${shipmentId}` }
            : o
        ));

      } catch (error: any) {
        console.error(`Failed to create shipment for order ${order.id}:`, error);
        setBulkShipmentProgress(prev => ({
          ...prev,
          completed: prev.completed + 1,
          failed: prev.failed + 1,
          results: [...prev.results, {
            orderId: order.id,
            orderNumber: order.order_number || order.id.slice(0, 8),
            success: false,
            message: error.message || "Unknown error"
          }],
        }));
      }

      // Small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setBulkShipmentProgress(prev => ({ ...prev, processing: false }));
    setSelectedOrders(new Set());
  };

  const columns = [
    {
      key: "select",
      header: () => (
        <div className="flex items-center">
          <Checkbox
            checked={selectedOrders.size > 0 && selectedOrders.size === orders.filter(o =>
              (o.status === "pending" || o.status === "processing") && !o.tracking_number
            ).length}
            onCheckedChange={(checked) => {
              if (checked) {
                selectAllShippable();
              } else {
                clearSelection();
              }
            }}
          />
        </div>
      ),
      render: (row: OrderWithItems) => {
        const isShippable = (row.status === "pending" || row.status === "processing") && !row.tracking_number;
        return (
          <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selectedOrders.has(row.id)}
              onCheckedChange={() => toggleOrderSelection(row.id)}
              disabled={!isShippable}
            />
          </div>
        );
      },
    },
    {
      key: "id",
      header: "Order ID",
      render: (row: OrderWithItems) => (
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.id.slice(0, 8)}...
        </Link>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (row: OrderWithItems) => (
        <div>
          <div className="font-medium">{getCustomerName(row)}</div>
          <div className="text-xs text-muted-foreground">{getCustomerEmail(row)}</div>
        </div>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (row: OrderWithItems) => row.items?.length || 0,
    },
    {
      key: "total",
      header: "Total",
      render: (row: OrderWithItems) => {
        // Use total_amount from database, fallback to total for backward compatibility
        const total = row.total_amount || row.total || 0;
        return (
          <span className="font-medium">{formatCurrency(total)}</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (row: OrderWithItems) => (
        <Select
          value={row.status || "pending"}
          onValueChange={(value) => handleStatusChange(row.id, value)}
          disabled={updatingStatus === row.id}
        >
          <SelectTrigger className="w-32 h-8">
            {updatingStatus === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="return_requested">Return Requested</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
            <SelectItem value="return_rejected">Return Rejected</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "payment_status",
      header: "Payment",
      render: (row: OrderWithItems) => {
        const paymentStatus = row.payment_status || "pending";
        const isPaid = paymentStatus === "paid";
        return (
          <Badge
            variant={isPaid ? "default" : "destructive"}
            className="capitalize"
          >
            {isPaid ? "Paid" : paymentStatus === "failed" ? "Failed" : "Abandoned"}
          </Badge>
        );
      },
    },
    {
      key: "tracking",
      header: "AWB",
      render: (row: OrderWithItems) => {
        if (row.tracking_number) {
          return (
            <span className="text-xs font-mono text-green-600">
              {row.tracking_number.slice(0, 12)}...
            </span>
          );
        }
        return <span className="text-xs text-muted-foreground">-</span>;
      },
    },
    {
      key: "date",
      header: "Date",
      render: (row: OrderWithItems) => formatDate(row.created_at),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: OrderWithItems) => (
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/admin/orders/${row.id}`}>
            <Eye className="h-4 w-4" />
            <span className="sr-only">View order</span>
          </Link>
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const shippableCount = orders.filter(o =>
    (o.status === "pending" || o.status === "processing") &&
    o.payment_status === "paid" &&
    !o.tracking_number
  ).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Bulk Shipment Modal */}
      <Dialog open={showBulkShipmentModal} onOpenChange={setShowBulkShipmentModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Bulk Shipment Progress
            </DialogTitle>
            <DialogDescription>
              Creating shipments for {bulkShipmentProgress.total} orders...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Progress Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{bulkShipmentProgress.completed}</div>
                <div className="text-sm text-blue-600">Completed</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {bulkShipmentProgress.completed - bulkShipmentProgress.failed}
                </div>
                <div className="text-sm text-green-600">Success</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{bulkShipmentProgress.failed}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#009744] h-3 rounded-full transition-all duration-300"
                style={{ width: `${(bulkShipmentProgress.completed / bulkShipmentProgress.total) * 100}%` }}
              />
            </div>

            {/* Results List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {bulkShipmentProgress.results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckSquare className="h-4 w-4 text-green-600" />
                      ) : (
                        <Square className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">{result.orderNumber}</span>
                    </div>
                    <span className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {result.message}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowBulkShipmentModal(false)}
              disabled={bulkShipmentProgress.processing}
            >
              {bulkShipmentProgress.processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Close"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and track customer orders
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {selectedOrders.size > 0 && (
            <>
              <Button
                onClick={handleBulkShipment}
                className="bg-[#009744] hover:bg-[#008339]"
                disabled={!shiprocketConfig?.token}
              >
                <Truck className="mr-2 h-4 w-4" />
                Ship {selectedOrders.size} Orders
              </Button>
              <Button variant="outline" onClick={clearSelection}>
                Clear Selection
              </Button>
            </>
          )}
          {shippableCount > 0 && selectedOrders.size === 0 && (
            <Button variant="outline" onClick={selectAllShippable}>
              <Package className="mr-2 h-4 w-4" />
              Select {shippableCount} Shippable
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrders}
            disabled={loading}
            className="h-9 sm:h-10"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-9 sm:h-10">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 h-9 sm:h-10">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Orders</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="return_requested">Return Requested</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="return_rejected">Return Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No orders found</p>
        </div>
      ) : (
        <DataTable
          data={orders}
          columns={columns}
          searchKey="id"
          onRowClick={(row) => {
            router.push(`/admin/orders/${row.id}`);
          }}
        />
      )}
    </div>
  );
}

 export default function OrdersPage() {
   return (
     <Suspense
       fallback={
         <div className="flex items-center justify-center h-96">
           <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
         </div>
       }
     >
       <OrdersContent />
     </Suspense>
   );
 }
