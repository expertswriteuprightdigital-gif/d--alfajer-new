import { createClient as createServerClient } from "@/src/lib/supabase/server";
import { ProductDetail } from "@/src/components/products/ProductDetail";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

interface ProductPageProps {
    params: Promise<{
        slug: string;
    }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Cached data fetcher: resolve by slug or by id (when param looks like UUID)
const getProduct = cache(async (slugOrId: string) => {
    const param = String(slugOrId || "").trim();
    if (!param || param === "undefined" || param === "null") return null;

    const supabase = await createServerClient();
    const isUuid = UUID_REGEX.test(param);
    const query = supabase
        .from("products")
        .select(`
      *,
      variants:product_variants(*),
      category:categories(*)
    `)
        .eq("is_active", true);

    const { data } = isUuid
        ? await query.eq("id", param).single()
        : await query.eq("slug", param).single();

    // Transform storage paths to public URLs
    if (data && data.images) {
        const transformedImages = Array.isArray(data.images)
            ? data.images.map((img: string) => {
                if (!img) return null;
                if (typeof img === "string" && (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("/"))) {
                    return img;
                }
                try {
                    const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(img);
                    return urlData.publicUrl;
                } catch (e) {
                    return null;
                }
            }).filter(Boolean)
            : [];
        return { ...data, images: transformedImages };
    }

    return data;
});

// Transformer function (matching logic from use-products.ts)
function transformProduct(dbProduct: any) {
    if (!dbProduct) return null;

    const primaryVariant = dbProduct.variants?.[0];
    // Filter out empty strings and null/undefined values from images
    const rawImages = dbProduct.images || [];
    const images = Array.isArray(rawImages)
        ? rawImages.filter((img: string) => img && img.trim() !== "")
        : [];
    const mainImage = images.length > 0 ? images[0] : "/images/placeholder.jpg";

    return {
        id: dbProduct.id,
        name: dbProduct.name,
        slug: dbProduct.slug,
        image: mainImage,
        images: images.length > 0 ? images : ["/images/placeholder.jpg"],
        price: primaryVariant?.price || dbProduct.base_price || 0,
        originalPrice: primaryVariant?.compare_at_price || dbProduct.original_price || undefined,
        discount: primaryVariant?.compare_at_price
            ? Math.round(((primaryVariant.compare_at_price - primaryVariant.price) / primaryVariant.compare_at_price) * 100)
            : undefined,
        rating: dbProduct.rating || 0,
        reviews: dbProduct.review_count || 0,
        packageSize: primaryVariant?.weight || "N/A",
        origin: dbProduct.origin || "Unknown",
        description: dbProduct.description || "",
        longDescription: dbProduct.long_description || "",
        certifications: dbProduct.certifications || [],
        inStock: (primaryVariant?.stock_quantity || 0) > 0,
        onSale: !!dbProduct.badge && dbProduct.badge === "SALE",
        badge: dbProduct.badge,
        category: dbProduct.category?.name || "Uncategorized",
        variants: dbProduct.variants?.map((v: any) => ({
            id: v.id,
            weight: v.weight,
            size: v.size || v.weight,
            display_name: v.display_name || v.size || v.weight,
            price: v.price,
            originalPrice: v.compare_at_price || v.original_price || undefined,
            stock: v.stock_quantity || 0,
            sku: v.sku,
            is_default: v.is_default,
        })) || [],
        nutritionFacts: dbProduct.nutrition_facts || {
            servingSize: "100g",
            calories: 0,
            protein: "0g",
            fat: "0g",
            carbs: "0g",
            fiber: "0g"
        },
        ingredients: dbProduct.ingredients
            ? (typeof dbProduct.ingredients === 'string'
                ? dbProduct.ingredients.split(',').map((i: string) => i.trim())
                : Array.isArray(dbProduct.ingredients) ? dbProduct.ingredients : [])
            : [],
        allergenInfo: dbProduct.allergen_info
            ? (typeof dbProduct.allergen_info === 'string'
                ? dbProduct.allergen_info.split(',').map((i: string) => i.trim())
                : Array.isArray(dbProduct.allergen_info) ? dbProduct.allergen_info : [])
            : [],
    };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { slug } = await params;
    const dbProduct = await getProduct(slug);
    const product = transformProduct(dbProduct);

    if (!product) {
        return {
            title: "Product Not Found | Al Fajer",
            description: "The product you're looking for doesn't exist.",
        };
    }

    return {
        title: `${product.name} | Al Fajer`,
        description: product.description || `Buy ${product.name} at Al Fajer`,
        openGraph: {
            title: product.name,
            description: product.description || "",
            images: product.images || [],
        },
    };
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    const dbProduct = await getProduct(slug);

    if (!dbProduct) {
        notFound();
    }

    const product = transformProduct(dbProduct);

    return (
        <main className="min-h-screen bg-white">
            <ProductDetail initialProduct={product} />
        </main>
    );
}
