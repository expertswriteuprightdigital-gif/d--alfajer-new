"use client";

import { createClient } from "./client";
import type { Database } from "./database.types";
// Force Node to use the correct Cloudflare IP for Supabase
// This bypasses local DNS hijacking (Jio NAT64) — ONLY in development
if (typeof window === "undefined" && process.env.NODE_ENV === "development") {
  try {
    const dns = eval('require("node:dns")');
    const originalLookup = dns.lookup;
    // @ts-ignore - overriding built-in Node type
    dns.lookup = (hostname: string, options: any, callback: any) => {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      // Intercept any Supabase domain resolution
      if (hostname.includes("supabase.co")) {
        if (options && options.all) {
          return callback(null, [{ address: "104.18.38.10", family: 4 }]);
        }
        return callback(null, "104.18.38.10", 4);
      }
      return originalLookup(hostname, options, callback);
    };
  } catch (e) {
    // Ignore DNS override errors
  }
}

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];

// Create a new product (admin)
export async function createProduct(product: {
    name: string;
    slug: string;
    description?: string;
    long_description?: string;
    category_id?: string;
    base_price: number;
    original_price?: number;
    images?: string[];
    origin?: string;
    certifications?: string[];
    allergen_info?: string;
    ingredients?: string;
    nutrition_facts?: Record<string, unknown>;
    badge?: "SALE" | "HOT" | "NEW";
    is_active?: boolean;
}): Promise<Product | null> {
    const supabase = createClient();

    const { description, ingredients, allergen_info, ...rest } = product;

    const { data, error } = await supabase
        .from("products")
        .insert({
            ...rest,
            short_description: description || '',
            long_description: product.long_description || description || '', // Populate long_description
            ingredients: ingredients ? ingredients.split(',').map(s => s.trim()) : [],
            allergen_info: allergen_info ? allergen_info.split(',').map(s => s.trim()) : [],
            is_active: product.is_active ?? true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

    if (error) {
        console.error("Error creating product:", JSON.stringify(error, null, 2)); // improved logging
        return null;
    }

    return data;
}

// Update a product (admin)
export async function updateProduct(
    productId: string,
    updates: any
): Promise<boolean> {
    const supabase = createClient();

    const { description, ingredients, allergen_info, ...rest } = updates;

    const dbUpdates: any = { ...rest };

    if (description !== undefined) dbUpdates.short_description = description;
    if (ingredients !== undefined) {
        dbUpdates.ingredients = typeof ingredients === 'string'
            ? ingredients.split(',').map((s: string) => s.trim())
            : ingredients;
    }
    if (allergen_info !== undefined) {
        dbUpdates.allergen_info = typeof allergen_info === 'string'
            ? allergen_info.split(',').map((s: string) => s.trim())
            : allergen_info;
    }

    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase
        .from("products")
        .update(dbUpdates)
        .eq("id", productId);

    if (error) {
        console.error("Error updating product:", error);
        return false;
    }

    return true;
}

// Delete a product (admin)
export async function deleteProduct(productId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

    if (error) {
        console.error("Error deleting product:", error);
        return false;
    }

    return true;
}

// Create a product variant (admin)
export async function createVariant(variant: {
    product_id: string;
    sku: string;
    weight: string;
    price: number;
    compare_at_price?: number;
    stock_quantity?: number;
    size?: string;
}): Promise<ProductVariant | null> {
    const supabase = createClient();

    const { compare_at_price, stock_quantity, size, ...rest } = variant;

    const { data, error } = await supabase
        .from("product_variants")
        .insert({
            ...rest,
            original_price: compare_at_price,
            stock: stock_quantity,
            size: size || 'Standard',
        } as any)
        .select()
        .single();

    if (error) {
        console.error("Error creating variant:", JSON.stringify(error, null, 2));
        return null;
    }

    return data;
}

// Update a variant (admin)
export async function updateVariant(
    variantId: string,
    updates: Partial<ProductVariant>
): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from("product_variants")
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq("id", variantId);

    if (error) {
        console.error("Error updating variant:", error);
        return false;
    }

    return true;
}

// Delete a variant (admin)
export async function deleteVariant(variantId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from("product_variants")
        .delete()
        .eq("id", variantId);

    if (error) {
        console.error("Error deleting variant:", error);
        return false;
    }

    return true;
}

// Update stock quantity (admin)
export async function updateStock(
    variantId: string,
    quantity: number
): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
        .from("product_variants")
        .update({ stock_quantity: quantity })
        .eq("id", variantId);

    if (error) {
        console.error("Error updating stock:", error);
        return false;
    }

    return true;
}

// Get all products for admin (includes inactive)
export async function getAdminProducts(): Promise<(Product & { variants: ProductVariant[] })[]> {
    const supabase = createClient();

    const { data, error } = await supabase
        .from("products")
        .select(`
      *,
      variants:product_variants(*),
      category:categories(*)
    `)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching admin products:", error);
        return [];
    }

    // Normalize image paths to public URLs (handles both stored paths and already public URLs)
    const products = (data || []) as (Product & { variants: ProductVariant[] })[];
    const mapped = products.map((p) => {
        const imgs = Array.isArray(p.images)
            ? p.images
                  .map((img: string) => {
                      if (!img) return null;
                      if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("/"))) {
                          return img;
                      }
                      try {
                          const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(img);
                          return publicUrl;
                      } catch (e) {
                          return null;
                      }
                  })
                  .filter(Boolean)
            : [];

        return {
            ...p,
            images: imgs,
        } as Product & { variants: ProductVariant[] };
    });

    return mapped;
}

// Category management (admin)
export async function createCategory(category: {
    name: string;
    slug: string;
    description?: string | null;
    image_url?: string | null;
    parent_id?: string | null;
}): Promise<Database["public"]["Tables"]["categories"]["Row"] | null> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from("categories")
        .insert({
            ...category,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating category:", error);
        return null;
    }
    return data;
}

export async function updateCategory(categoryId: string, updates: Partial<Database["public"]["Tables"]["categories"]["Update"]>): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
        .from("categories")
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq("id", categoryId);

    if (error) {
        console.error("Error updating category:", error);
        return false;
    }
    return true;
}

export async function deleteCategory(categoryId: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

    if (error) {
        console.error("Error deleting category:", error);
        return false;
    }
    return true;
}

// Upload product image via Cloudinary
export async function uploadProductImage(
    file: File,
    productId: string
): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "alfajer/products");

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            console.error("Upload failed:", res.status, await res.text());
            return null;
        }

        const data = await res.json();
        return data.url || null;
    } catch (error) {
        console.error("Error uploading image:", error);
        return null;
    }
}

// Delete product image (handles both Cloudinary and local paths)
export async function deleteProductImage(imageUrl: string): Promise<boolean> {
    // For local images (served from /public), no remote deletion needed
    if (imageUrl.startsWith("/")) {
        return true;
    }
    // For Cloudinary images, we'd need the public_id to delete
    // For now, just return true (Cloudinary has its own media library for cleanup)
    return true;
}

// Get admin dashboard stats
export async function getDashboardStats() {
    const supabase = createClient();

    // Parallel fetch for speed
    const [
        { count: orderCount, error: orderError },
        { data: revenueData, error: revenueError },
        { count: productsCount, error: productsError },
        { count: customersCount, error: customersError },
        { data: recentOrders, error: recentOrdersError },
        { data: lowStockProducts, error: lowStockError }
    ] = await Promise.all([
        // Total orders
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        // Revenue (sum total_amount)
        supabase.from('orders').select('total_amount').neq('status', 'cancelled'),
        // Active products
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        // Total customers
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        // Recent orders
        supabase.from('orders')
            .select(`
                id,
                user_id,
                total_amount,
                status,
                created_at,
                email
            `)
            .order('created_at', { ascending: false })
            .limit(5),
        // Low stock products (less than 10) - use 'stock_quantity' column which is the actual DB column
        supabase.from('product_variants')
            .select('product_id, stock_quantity, products(id, name, slug)')
            .lt('stock_quantity', 10)
            .limit(5)
    ]);

    // Calculate total revenue
    const totalRevenue = (revenueData as any[])?.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0) || 0;

    // Fetch visitors count
    const visitorsCount = await getStoreSetting('visitors_count') || 0;

    // Calculate growth (mock logic for now as we don't have historical data easily accessible without complex queries)
    const stats = {
        totalRevenue: { value: totalRevenue, change: 0 },
        totalOrders: { value: orderCount || 0, change: 0 },
        activeProducts: { value: productsCount || 0, change: 0 },
        activeCustomers: { value: customersCount || 0, change: 0 },
        totalVisitors: { value: Number(visitorsCount) || 0, change: 0 },
        recentOrders: recentOrders || [],
        lowStockProducts: (lowStockProducts as any[])?.map(p => ({
            id: p.product_id,
            name: p.products?.name,
            slug: p.products?.slug,
            stock: p.stock
        })) || []
    };

    return stats;
}

// Get sales chart data (last 7 days)
export async function getSalesChartData() {
    const supabase = createClient();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: orders } = await supabase
        .from('orders')
        .select('created_at, total_amount')
        .gte('created_at', sevenDaysAgo.toISOString())
        .neq('status', 'cancelled')
        .order('created_at');

    // Group by day
    const chartData: Record<string, number> = {};
    (orders as any[])?.forEach(order => {
        if (!order.created_at) return;
        const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        chartData[date] = (chartData[date] || 0) + (Number(order.total_amount) || 0);
    });

    return Object.entries(chartData).map(([date, amount]) => ({ name: date, total: amount }));
}

// --- Categories ---
export async function getAdminCategories() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
  return data;
}

// --- Customers ---
export async function getCustomers() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching customers:", error);
    return [];
  }
  return data;
}

// --- Coupons ---
export async function getCoupons() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching coupons:", error);
    return [];
  }
  return data;
}

export async function createCoupon(coupon: any) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("coupons")
    .insert({
        ...coupon,
        created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating coupon:", error);
    return null;
  }
  return data;
}

export async function updateCoupon(id: string, updates: any) {
  const supabase = createClient();
  const { error } = await supabase
    .from("coupons")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("Error updating coupon:", error);
    return false;
  }
  return true;
}

export async function deleteCoupon(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("coupons")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting coupon:", error);
    return false;
  }
  return true;
}

// --- Banners ---
export async function getBanners() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("banners")
    .select("*")
    .order("display_order");

  if (error) {
    console.error("Error fetching banners:", error);
    return [];
  }
  return data;
}

export async function createBanner(banner: any) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("banners")
    .insert({
        ...banner,
        updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating banner:", error);
    return null;
  }
  return data;
}

export async function updateBanner(id: string, updates: any) {
  const supabase = createClient();
  const { error } = await supabase
    .from("banners")
    .update({
        ...updates,
        updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating banner:", error);
    return false;
  }
  return true;
}

export async function deleteBanner(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("banners")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting banner:", error);
    return false;
  }
  return true;
}

export async function uploadBannerImage(file: File): Promise<string | null> {
    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", "alfajer/banners");

        const res = await fetch("/api/upload", {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            console.error("Banner upload failed:", res.status, await res.text());
            return null;
        }

        const data = await res.json();
        return data.url || null;
    } catch (error) {
        console.error("Error uploading banner image:", error);
        return null;
    }
}


// --- Announcements ---
export async function getAnnouncements() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching announcements:", error);
    return [];
  }
  return data;
}

export async function createAnnouncement(announcement: any) {
  const supabase = createClient();

  const payload = {
      content: announcement.content,
      link_url: announcement.link_url || null,
      start_date: announcement.start_date || null,
      end_date: announcement.end_date || null,
      is_active: announcement.is_active,
      updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("announcements")
    .insert(payload as any)
    .select()
    .single();

  if (error) {
    console.error("Error creating announcement:", error);
    return null;
  }
  return data;
}

export async function updateAnnouncement(id: string, updates: any) {
  const supabase = createClient();

  const payload: any = {
      updated_at: new Date().toISOString()
  };

  if (updates.content !== undefined) payload.content = updates.content;
  if (updates.link_url !== undefined) payload.link_url = updates.link_url || null;
  if (updates.start_date !== undefined) payload.start_date = updates.start_date || null;
  if (updates.end_date !== undefined) payload.end_date = updates.end_date || null;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { error } = await supabase
    .from("announcements")
    .update(payload)
    .eq("id", id);

  if (error) {
    console.error("Error updating announcement:", error);
    return false;
  }
  return true;
}

export async function deleteAnnouncement(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting announcement:", error);
    return false;
  }
  return true;
}

// --- Email Campaigns ---
export async function getEmailCampaigns() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
    return [];
  }
  return data;
}

export async function createEmailCampaign(campaign: any) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("email_campaigns")
    .insert({
        ...campaign,
        updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    return null;
  }
  return data;
}

export async function updateEmailCampaign(id: string, updates: any) {
  const supabase = createClient();
  const { error } = await supabase
    .from("email_campaigns")
    .update({
        ...updates,
        updated_at: new Date().toISOString()
    })
    .eq("id", id);

  if (error) {
    console.error("Error updating campaign:", error);
    return false;
  }
  return true;
}

export async function deleteEmailCampaign(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("email_campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting campaign:", error);
    return false;
  }
}

// --- Analytics: Product Performance ---
export async function getProductPerformanceData() {
  const supabase = createClient();

  // 1. Fetch all order items
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('product_id, quantity, price, total');

  if (itemsError) {
    console.error("Error fetching order items:", JSON.stringify(itemsError, null, 2));
    // If order_items table missing, return empty
    return [];
  }

  if (!items || items.length === 0) return [];

  // 2. Fetch all products (to get names/prices)
  // Optimization: Could fetch only IDs in items, but fetching all active is fine for now
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, name, slug, base_price');

  if (productsError) {
    console.error("Error fetching products:", JSON.stringify(productsError, null, 2));
    return [];
  }

  // Map products
  const productMap = new Map((products as any[])?.map(p => [p.id, p]));

  // 3. Aggregate
  const productStats: Record<string, { id: string; name: string; slug: string; totalSold: number; totalRevenue: number; currentPrice: number }> = {};

  items.forEach((item: any) => {
    const pid = item.product_id;
    const product = productMap.get(pid);

    // If product deleted, use placeholder or skip? Use placeholder to show legacy revenue.
    const name = product ? product.name : 'Unknown Product';
    const slug = product ? product.slug : '#';
    const currentPrice = product ? product.base_price : 0;

    if (!productStats[pid]) {
        productStats[pid] = {
            id: pid,
            name,
            slug,
            totalSold: 0,
            totalRevenue: 0,
            currentPrice
        };
    }

    // Use total from item if available, else calc
    const revenue = item.total || (item.quantity * (item.price || 0));
    productStats[pid].totalSold += item.quantity || 0;
    productStats[pid].totalRevenue += revenue || 0;
  });

  return Object.values(productStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
}

// --- Analytics: Customer Insights ---
export async function getCustomerInsightsData() {
  const supabase = createClient();

  // 1. Fetch customers
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, first_name, last_name, email, city');

  if (customerError) {
    console.error("Error fetching customers:", JSON.stringify(customerError, null, 2));
    return [];
  }

  // 2. Fetch all orders
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('user_id, total, created_at, status')
    .neq('status', 'cancelled'); // Exclude cancelled

  if (orderError) {
    console.error("Error fetching orders:", JSON.stringify(orderError, null, 2));
    return [];
  }

  // 3. Aggregate Orders by User
  const userOrders: Record<string, { totalSpent: number; count: number; lastOrder: string }> = {};

  (orders as any[])?.forEach(o => {
      if (!o.user_id) return;
      if (!userOrders[o.user_id]) {
          userOrders[o.user_id] = { totalSpent: 0, count: 0, lastOrder: o.created_at };
      }
      userOrders[o.user_id].totalSpent += o.total || 0;
      userOrders[o.user_id].count += 1;
      // Update last order if newer
      if (new Date(o.created_at) > new Date(userOrders[o.user_id].lastOrder)) {
          userOrders[o.user_id].lastOrder = o.created_at;
      }
  });

  // 4. Merge
  const insights = (customers as any[])?.map(c => {
      const stats = userOrders[c.id] || { totalSpent: 0, count: 0, lastOrder: null };
      return {
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'No Name',
          email: c.email,
          location: c.city || 'Unknown',
          totalSpent: stats.totalSpent,
          totalOrders: stats.count,
          lastOrderDate: stats.lastOrder
      };
  });

  return insights.sort((a, b) => b.totalSpent - a.totalSpent);
}

// --- Analytics: Sales Reports ---
export async function getDetailedSalesData() {
  const supabase = createClient();

  // 1. Fetch all orders
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, total_amount, created_at, user_id')
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });

  if (orderError) {
    console.error("Error fetching sales data:", JSON.stringify(orderError, null, 2));
    return null;
  }

  // 2. Fetch Active Customers count
  const { count: activeCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true });

  if (!orders || orders.length === 0) {
    return {
      kpi: {
        totalRevenue: 0,
        totalOrders: 0,
        avgOrderValue: 0,
        activeCustomers: activeCustomers || 0
      },
      chartData: []
    };
  }

  // 3. Aggregate Monthly Sales
  const monthlySales: Record<string, number> = {};
  const monthOrder = new Map<string, Date>(); // To sort correctly later

  orders.forEach((o: any) => {
    const date = new Date(o.created_at);
    const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); // "Jan 2024"
    if (!monthlySales[monthKey]) {
      monthlySales[monthKey] = 0;
      monthOrder.set(monthKey, date);
    }
    // Use total_amount
    monthlySales[monthKey] += o.total_amount || 0;
  });

  // Calculate KPIs
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Format Chart Data
  const chartData = Object.entries(monthlySales)
    .sort(([keyA], [keyB]) => {
        const dateA = monthOrder.get(keyA)?.getTime() || 0;
        const dateB = monthOrder.get(keyB)?.getTime() || 0;
        return dateA - dateB;
    })
    .map(([month, sales]) => ({
      month,
      sales
    }));


  return {
    kpi: {
      totalRevenue,
      totalOrders,
      avgOrderValue,
      activeCustomers: activeCustomers || 0
    },
    chartData
  };
}

// --- Content: Blogs ---
export async function getBlogs(): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('blogs' as any)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching blogs:", JSON.stringify(error, null, 2));
    return [];
  }
  return data || [];
}

export async function getBlog(id: string): Promise<any> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('blogs' as any)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching blog:", JSON.stringify(error, null, 2));
    return null;
  }
  return data;
}

export async function createBlog(blog: any) {
  const supabase = createClient();

  // Auto-generate slug if missing
  const slug = blog.slug || blog.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const { data, error } = await supabase
    .from('blogs' as any)
    .insert({
      title: blog.title,
      slug: slug,
      excerpt: blog.excerpt,
      content: blog.content,
      image_url: blog.image_url,
      is_published: blog.is_published ?? false,
      published_at: blog.is_published ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating blog:", JSON.stringify(error, null, 2));
    throw error;
  }
  return data;
}

export async function updateBlog(id: string, updates: any) {
  const supabase = createClient();

  const payload: any = {
    ...updates,
    updated_at: new Date().toISOString()
  };

  if (updates.title && !updates.slug) {
     // Optional: update slug if title changes? Usually bad for SEO. Keep existing slug unless explicitly changed.
  }

  const { error } = await supabase
    .from('blogs' as any)
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error("Error updating blog:", JSON.stringify(error, null, 2));
    throw error;
  }
  return true;
}

export async function deleteBlog(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from('blogs' as any)
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting blog:", JSON.stringify(error, null, 2));
    throw error;
  }
  return true;
}

export async function getBlogBySlug(slug: string): Promise<any> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('blogs' as any)
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    console.error("Error fetching blog by slug:", JSON.stringify(error, null, 2));
    return null;
  }
  return data;
}

// --- Store Settings ---
export interface StoreSetting {
  key: string;
  value: any;
  description?: string;
  updated_at?: string;
  created_at?: string;
}

export async function getStoreSetting(key: string): Promise<any> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_settings' as any)
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching store setting '${key}':`, error);
    return null;
  }
  return (data as any)?.value;
}

export async function getAllStoreSettings(): Promise<StoreSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('store_settings' as any)
    .select('*')
    .order('key');

  if (error) {
    console.error("Error fetching store settings:", error);
    return [];
  }
  return (data as unknown as StoreSetting[]) || [];
}

export async function updateStoreSetting(key: string, value: any, description?: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('store_settings' as any)
    .upsert({
      key,
      value,
      description: description || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });

  if (error) {
    console.error(`Error updating store setting '${key}':`, error);
    return false;
  }
  return true;
}

export async function isCodEnabled(): Promise<boolean> {
  const value = await getStoreSetting('enable_cod');
  return value === true || value === 'true';
}
