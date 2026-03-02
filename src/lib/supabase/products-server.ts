/**
 * Server-only product/category helpers for RSC (no "use client").
 * Use these in Server Components; use @/src/lib/supabase/products for client components.
 */
import { createClient } from "./server";
import type { Database } from "./database.types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductVariant = Database["public"]["Tables"]["product_variants"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];

export type CategoryRow = Category;

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
  category: Category | null;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error) {
    console.error("Error fetching category by slug:", error);
    return null;
  }
  return data;
}

export async function getProducts(options?: {
  categorySlug?: string;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "price" | "created_at";
  sortOrder?: "asc" | "desc";
}): Promise<ProductWithVariants[]> {
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select(
      `
      *,
      variants:product_variants(*),
      category:categories(*)
    `
    )
    .eq("is_active", true);

  if (options?.categorySlug) {
    const { data: category } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", options.categorySlug)
      .single();

    if (category) {
      query = query.eq("category_id", category.id);
    }
  }

  if (options?.sortBy) {
    const column = options.sortBy === "price" ? "base_price" : options.sortBy;
    query = query.order(column, { ascending: options.sortOrder === "asc" });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset && options?.limit) {
    query = query.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
    return [];
  }

  const products = (data || []) as ProductWithVariants[];

  const mapped = products.map((p) => {
    const images = Array.isArray(p.images)
      ? (p.images as string[])
          .map((img: string) => {
            if (!img) return null;
            if (
              typeof img === "string" &&
              (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("/"))
            ) {
              return img;
            }
            try {
              const {
                data: { publicUrl },
              } = supabase.storage.from("product-images").getPublicUrl(img);
              return publicUrl;
            } catch {
              return null;
            }
          })
          .filter((x): x is string => Boolean(x))
      : [];

    return { ...p, images };
  });

  return mapped;
}
