"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, ShoppingBag, DollarSign, Users, Loader2, Mail } from "lucide-react";
import { DataTable } from "@/src/components/admin/data-table";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { getCustomers } from "@/src/lib/supabase/admin";
import { formatCurrency } from "@/src/lib/utils";
import { toast } from "sonner";

interface Customer {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  country: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields
  totalOrders?: number;
  totalSpent?: number;
}

const formatDate = (dateString: string | null) => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        setLoading(true);
        const data = await getCustomers();
        setCustomers((data as unknown as Customer[]) || []);
      } catch (error) {
        console.error("Error fetching customers:", error);
        toast.error("Failed to load customers");
      } finally {
        setLoading(false);
      }
    }

    fetchCustomers();
  }, []);

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (row: Customer) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#009744] to-[#2E763B] flex items-center justify-center text-white font-bold">
            {(row.full_name || row.email || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium">{row.full_name || "No Name"}</div>
            <div className="text-xs text-muted-foreground">{row.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row: Customer) => (
        <span className="text-sm">{row.phone || "Not provided"}</span>
      ),
    },
    {
      key: "country",
      header: "Country",
      render: (row: Customer) => (
        <span className="text-sm">{row.country || "Unknown"}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row: Customer) => (
        <Badge variant={row.role === "admin" ? "default" : "secondary"} className="capitalize">
          {row.role || "customer"}
        </Badge>
      ),
    },
    {
      key: "joinDate",
      header: "Member Since",
      render: (row: Customer) => formatDate(row.created_at),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: Customer) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/customers/${row.id}`}>
              <Eye className="h-4 w-4" />
              <span className="sr-only">View customer</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <a href={`mailto:${row.email}`}>
              <Mail className="h-4 w-4" />
              <span className="sr-only">Email customer</span>
            </a>
          </Button>
        </div>
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

  const totalCustomers = customers.length;
  const adminUsers = customers.filter((c) => c.role === "admin").length;
  const recentCustomers = customers.filter((c) => {
    const date = new Date(c.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage and view registered customers
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-gradient-to-br from-white to-green-50 border-green-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Customers</CardTitle>
            <Users className="h-5 w-5 text-[#009744]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[#009744]">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">Registered users</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-white to-blue-50 border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">New This Month</CardTitle>
            <ShoppingBag className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{recentCustomers}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-white to-purple-50 border-purple-100">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admin Users</CardTitle>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{adminUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">With admin access</p>
          </CardContent>
        </Card>
      </div>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No customers found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Customers will appear here when they register
              </p>
            </div>
          ) : (
            <DataTable
              data={customers}
              columns={columns}
              searchKey="full_name"
              onRowClick={(row) => {
                router.push(`/admin/customers/${row.id}`);
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
