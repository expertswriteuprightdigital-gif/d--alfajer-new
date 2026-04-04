"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, X, Eye, Plus, Heart, Star, Check, Loader2 } from "lucide-react";
import { useCartStore } from "@/src/lib/cart-store";
import { useWishlistStore } from "@/src/lib/wishlist-store";
import { useI18n } from "@/src/components/providers/i18n-provider";
import { CURRENCIES } from "@/src/lib/i18n";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Slider } from "@/src/components/ui/slider";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/src/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/src/components/ui/sheet";
import { cn } from "@/src/lib/utils";
import { ProductModal } from "./ProductModal";
import { motion, AnimatePresence } from "framer-motion";
import { useProducts, useCategories, type TransformedProduct } from "@/src/lib/hooks/use-products";
import { trackAddToCart, trackInitiateCheckout } from "@/src/utils/pixel";

interface FilterState {
  priceRange: [number, number];
  packageSizes: string[];
  origins: string[];
  certifications: string[];
  categories: string[];
  inStockOnly: boolean;
  onSaleOnly: boolean;
}

// Product page path: Combo always uses id (slug often has +/encoding or DB mismatch). Others use slug when valid.
function getProductHref(product: TransformedProduct): string {
  const categoryName = product.category?.name?.toLowerCase();
  if (categoryName === "combo") return `/products/${product.id}`;

  const slug = product.slug && String(product.slug).trim();
  const slugLower = slug?.toLowerCase();
  if (!slug || slug === "undefined" || (categoryName && slugLower === categoryName)) return `/products/${product.id}`;
  return `/products/${slug}`;
}

export function ProductListing() {
  const { t, formatCurrency, convertCurrency, currency } = useI18n();
  const searchParams = useSearchParams();

  // Fetch products from Supabase
  const { products: allProducts, loading, error } = useProducts();
  const { categories } = useCategories();

  // Get category from URL if present
  const categoryFromUrl = searchParams?.get('category') || '';

  // Only show categories that exist in the database and have products
  const allowedCategories = useMemo(() => {
    // Get unique category names from products that actually exist
    const categoriesWithProducts = new Set(
      allProducts
        .map(p => p.category?.name)
        .filter((name): name is string => Boolean(name))
    );

    // Return categories from database that have products
    return categories
      .filter(cat => categoriesWithProducts.has(cat.name))
      .map(cat => ({
        name: cat.name,
        id: cat.id,
        count: allProducts.filter(p => p.category?.name === cat.name).length
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, allProducts]);

  const [filters, setFilters] = useState<FilterState>({
    priceRange: [0, 10000],
    packageSizes: [],
    origins: [],
    certifications: [],
    categories: [],
    inStockOnly: false,
    onSaleOnly: false,
  });

  // Initialize category filter from URL
  useEffect(() => {
    if (categoryFromUrl && categories.length > 0) {
      // Find matching category by name
      const matchedCategory = categories.find(
        cat => cat.name.toLowerCase() === categoryFromUrl.toLowerCase() ||
          cat.name.toLowerCase().replace(/[&\s]+/g, '-') === categoryFromUrl.toLowerCase().replace(/[&\s]+/g, '-')
      );
      if (matchedCategory && !filters.categories.includes(matchedCategory.name)) {
        setFilters(prev => ({
          ...prev,
          categories: [matchedCategory.name]
        }));
      }
    }
  }, [categoryFromUrl, categories]);

  const [priceInputs, setPriceInputs] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState<string>("featured");
  const [selectedProduct, setSelectedProduct] = useState<TransformedProduct | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleProductClick = (product: TransformedProduct) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  // Get unique values for filters
  const uniqueOrigins = useMemo(() => {
    const origins = new Set(allProducts.map(p => p.origin).filter(Boolean));
    return Array.from(origins);
  }, [allProducts]);

  const uniqueCertifications = useMemo(() => {
    const certs = new Set(allProducts.flatMap(p => p.certifications || []));
    return Array.from(certs);
  }, [allProducts]);

  const uniquePackageSizes = useMemo(() => {
    const sizes = new Set(allProducts.map(p => p.packageSize).filter(s => s && s !== "N/A"));
    return Array.from(sizes);
  }, [allProducts]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return allProducts.filter((product) => {
      // Category filter
      if (filters.categories.length > 0 && !filters.categories.includes(product.category?.name || "")) {
        return false;
      }

      // Price filter
      if (product.price < filters.priceRange[0] || product.price > filters.priceRange[1]) {
        return false;
      }

      // Package size filter
      if (filters.packageSizes.length > 0 && !filters.packageSizes.includes(product.packageSize)) {
        return false;
      }

      // Origin filter
      if (filters.origins.length > 0 && !filters.origins.includes(product.origin)) {
        return false;
      }

      // Certifications filter
      if (filters.certifications.length > 0) {
        const hasCertification = filters.certifications.some((cert) =>
          (product.certifications || []).includes(cert)
        );
        if (!hasCertification) return false;
      }

      // Availability filters
      if (filters.inStockOnly && !product.inStock) return false;
      if (filters.onSaleOnly && !product.onSale) return false;

      return true;
    });
  }, [filters, allProducts]);

  // Sort products
  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts];
    switch (sortBy) {
      case "price-low":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-high":
        return sorted.sort((a, b) => b.price - a.price);
      case "rating":
        return sorted.sort((a, b) => b.rating - a.rating);
      case "newest":
        return sorted; // Already sorted by created_at desc from API
      default:
        return sorted;
    }
  }, [filteredProducts, sortBy]);

  const handlePriceRangeChange = (values: number[]) => {
    const newRange = [values[0], values[1]] as [number, number];
    setFilters((prev) => ({ ...prev, priceRange: newRange }));
    setPriceInputs(newRange);
  };

  const handlePriceInputChange = (index: 0 | 1, value: string) => {
    const numValue = parseInt(value) || 0;
    const newInputs: [number, number] = [...priceInputs];
    newInputs[index] = numValue;
    setPriceInputs(newInputs);
    setFilters((prev) => ({
      ...prev,
      priceRange: newInputs as [number, number],
    }));
  };

  const toggleFilter = (
    type: "packageSizes" | "origins" | "certifications" | "categories",
    value: string
  ) => {
    setFilters((prev) => {
      const current = prev[type];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const resetFilters = () => {
    setFilters({
      priceRange: [0, 10000],
      packageSizes: [],
      origins: [],
      certifications: [],
      categories: [],
      inStockOnly: false,
      onSaleOnly: false,
    });
    setPriceInputs([0, 10000]);
    setIsFilterOpen(false);
  };

  const originKeys: { [key: string]: string } = {
    "India": "filter.origin.india",
    "UAE": "filter.origin.uae",
    "Kashmir, India": "filter.origin.kashmirIndia",
    "Himalayas": "filter.origin.himalayas",
  };

  const certificationKeys: { [key: string]: string } = {
    "Organic": "filter.certification.organic",
    "Non-GMO": "filter.certification.nonGMO",
    "Gluten-Free": "filter.certification.glutenFree",
    "Pure": "filter.certification.pure",
    "Raw and unprocessed": "filter.certification.rawUnprocessed",
    "Premium Grade": "filter.certification.premiumGrade",
    "Traditional": "filter.certification.traditional",
    "Authentic": "filter.certification.authentic",
  };

  const renderFilterContent = () => (
    <>
      {/* Filter Header */}
      <div className="flex items-center justify-between pb-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Filter className="h-5 w-5 text-[#009744] shrink-0" />
          <h3 className="text-lg font-bold text-gray-900 font-poppins">Filters</h3>
        </div>
        <button
          onClick={resetFilters}
          className="text-sm text-[#009744] hover:text-[#2E763B] transition-colors font-semibold font-poppins whitespace-nowrap"
          aria-label="Clear all filters"
        >
          Clear all
        </button>
      </div>

      {/* Price Range */}
      <div className="space-y-4">
        <Label className="text-base font-bold text-gray-900 font-poppins">
          {t('filter.priceRange')}
        </Label>
        <div className="space-y-4">
          <Slider
            value={filters.priceRange}
            onValueChange={handlePriceRangeChange}
            min={0}
            max={10000}
            step={100}
            className="w-full [&_[role=slider]]:bg-[#009744] [&_[role=slider]]:border-[#009744] [&>div>div]:bg-[#009744]"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-wide">{t('filter.min')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  {CURRENCIES[currency]?.symbol || '₹'}
                </span>
                <Input
                  type="number"
                  value={priceInputs[0]}
                  onChange={(e) => handlePriceInputChange(0, e.target.value)}
                  className="border-gray-300 focus:border-[#009744] focus:ring-[#009744] pl-8 text-sm"
                  min={0}
                  max={10000}
                />
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-xs text-gray-500 mb-1.5 block uppercase tracking-wide">{t('filter.max')}</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                  {CURRENCIES[currency]?.symbol || '₹'}
                </span>
                <Input
                  type="number"
                  value={priceInputs[1]}
                  onChange={(e) => handlePriceInputChange(1, e.target.value)}
                  className="border-gray-300 focus:border-[#009744] focus:ring-[#009744] pl-8 text-sm"
                  min={0}
                  max={10000}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      {allowedCategories.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-bold text-gray-900 font-poppins">
            {t('filter.category')}
          </Label>
          <div className="space-y-2.5">
            {allowedCategories.map((category) => {
              const categoryKeyMap: { [key: string]: string } = {
                "Dry Fruits": "productCategory.premiumDryFruits",
                "Nuts": "productCategory.nutsSeeds",
                "Seeds": "productCategory.nutsSeeds",
                "Spices": "productCategory.authenticSpices",
                "Gift Packs": "productCategory.giftPacks",
                "Honey & Spreads": "productCategory.honeySpreads",
                "Tea & Beverages": "productCategory.teaBeverages",
                "Organic": "productCategory.organic",
                "Saffron": "productCategory.saffron",
                "Shilajit": "productCategory.shilajit",
              };
              const translationKey = categoryKeyMap[category.name] || `productCategory.${category.name.replace(/\s+/g, '')}`;
              const translated = t(translationKey);
              const displayName = translated === translationKey ? category.name : translated;
              return (
                <div key={category.id || category.name} className="flex items-center space-x-3 group/item">
                  <Checkbox
                    id={`category-${category.id || category.name}`}
                    checked={filters.categories.includes(category.name)}
                    onCheckedChange={() => toggleFilter("categories", category.name)}
                    className="border-gray-300 data-[state=checked]:bg-[#009744] data-[state=checked]:border-[#009744] rounded h-4 w-4"
                  />
                  <Label
                    htmlFor={`category-${category.id || category.name}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1 flex items-center justify-between group-hover/item:text-gray-900 transition-colors font-body"
                  >
                    <span className="font-medium">{displayName}</span>
                    <span className="text-gray-400 text-xs font-normal">({category.count})</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Package Size */}
      {uniquePackageSizes.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-bold text-gray-900 font-poppins">
            {t('filter.packageSize')}
          </Label>
          <div className="space-y-2.5">
            {uniquePackageSizes.map((size) => {
              const count = allProducts.filter((p) => p.packageSize === size).length;
              return (
                <div key={size} className="flex items-center space-x-3 group/item">
                  <Checkbox
                    id={`size-${size}`}
                    checked={filters.packageSizes.includes(size)}
                    onCheckedChange={() => toggleFilter("packageSizes", size)}
                    className="border-gray-300 data-[state=checked]:bg-[#009744] data-[state=checked]:border-[#009744] rounded h-4 w-4"
                  />
                  <Label
                    htmlFor={`size-${size}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1 flex items-center justify-between group-hover/item:text-gray-900 transition-colors font-body"
                  >
                    <span className="font-medium">{size}</span>
                    <span className="text-gray-400 text-xs font-normal">({count})</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Origin */}
      {uniqueOrigins.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-bold text-gray-900 font-poppins">
            {t('filter.origin')}
          </Label>
          <div className="space-y-2.5">
            {uniqueOrigins.map((origin) => {
              const count = allProducts.filter((p) => p.origin === origin).length;
              return (
                <div key={origin} className="flex items-center space-x-3 group/item">
                  <Checkbox
                    id={`origin-${origin}`}
                    checked={filters.origins.includes(origin)}
                    onCheckedChange={() => toggleFilter("origins", origin)}
                    className="border-gray-300 data-[state=checked]:bg-[#009744] data-[state=checked]:border-[#009744] rounded h-4 w-4"
                  />
                  <Label
                    htmlFor={`origin-${origin}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1 flex items-center justify-between group-hover/item:text-gray-900 transition-colors font-body"
                  >
                    <span className="font-medium">{originKeys[origin] ? t(originKeys[origin]) : origin}</span>
                    <span className="text-gray-400 text-xs font-normal">({count})</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Certifications */}
      {uniqueCertifications.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-bold text-gray-900 font-poppins">
            {t('filter.certification')}
          </Label>
          <div className="space-y-2.5">
            {uniqueCertifications.map((cert) => {
              const count = allProducts.filter((p) =>
                (p.certifications || []).includes(cert)
              ).length;
              return (
                <div key={cert} className="flex items-center space-x-3 group/item">
                  <Checkbox
                    id={`cert-${cert}`}
                    checked={filters.certifications.includes(cert)}
                    onCheckedChange={() => toggleFilter("certifications", cert)}
                    className="border-gray-300 data-[state=checked]:bg-[#009744] data-[state=checked]:border-[#009744] rounded h-4 w-4"
                  />
                  <Label
                    htmlFor={`cert-${cert}`}
                    className="text-sm text-gray-700 cursor-pointer flex-1 flex items-center justify-between group-hover/item:text-gray-900 transition-colors font-body"
                  >
                    <span className="font-medium">{certificationKeys[cert] ? t(certificationKeys[cert]) : cert}</span>
                    <span className="text-gray-400 text-xs font-normal">({count})</span>
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability */}
      <div className="space-y-3">
        <Label className="text-base font-bold text-gray-900 font-poppins">
          {t('filter.availability')}
        </Label>
        <div className="space-y-2.5">
          <div className="flex items-center space-x-3 group/item">
            <Checkbox
              id="in-stock"
              checked={filters.inStockOnly}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({ ...prev, inStockOnly: !!checked }))
              }
              className="border-gray-300 data-[state=checked]:bg-[#009744] data-[state=checked]:border-[#009744] rounded h-4 w-4"
            />
            <Label
              htmlFor="in-stock"
              className="text-sm text-gray-700 font-medium cursor-pointer group-hover/item:text-gray-900 transition-colors font-body"
            >
              {t('filter.inStockOnly')}
            </Label>
          </div>
          <div className="flex items-center space-x-3 group/item">
            <Checkbox
              id="on-sale"
              checked={filters.onSaleOnly}
              onCheckedChange={(checked) =>
                setFilters((prev) => ({ ...prev, onSaleOnly: !!checked }))
              }
              className="border-gray-300 data-[state=checked]:bg-[#009744] data-[state=checked]:border-[#009744] rounded h-4 w-4"
            />
            <Label
              htmlFor="on-sale"
              className="text-sm text-gray-700 font-medium cursor-pointer group-hover/item:text-gray-900 transition-colors font-body"
            >
              {t('filter.onSaleOnly')}
            </Label>
          </div>
        </div>
      </div>
    </>
  );

  // Loading state
  if (loading) {
    return (
      <section className="w-full py-12 sm:py-16 md:py-20 lg:py-28 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-[#009744] mb-4" />
            <p className="text-gray-600 font-medium">Loading products...</p>
          </div>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="w-full py-12 sm:py-16 md:py-20 lg:py-28 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
            <div className="max-w-md mx-auto">
              <h3 className="text-xl font-bold text-gray-900 mb-3 font-heading">
                Failed to load products
              </h3>
              <p className="text-base text-gray-600 mb-8 font-body">
                {error}
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-[#009744] hover:bg-[#2E763B] text-white font-bold rounded-full px-8 py-3 font-poppins"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-full py-12 sm:py-16 md:py-20 lg:py-28 bg-gray-50 pt-28 sm:pt-32 md:pt-36 lg:pt-40">
      <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 w-full">
        {/* Header */}
        <div className="mb-8 sm:mb-10 md:mb-14 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-5 font-heading">
            <span className="text-[#AB1F23]">{t('productCategory.title')}</span>{" "}
            <span className="text-[#009744]">{t('productCategory.titleSpan')}</span>
          </h2>
          <div className="flex flex-col items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3 justify-center">
              <div className="h-6 sm:h-8 w-[2px] bg-gradient-to-b from-[#AB1F23] to-[#009744] rounded-full hidden sm:block shrink-0" />
              <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-500 max-w-2xl font-body italic tracking-wide">
                {t('productCategory.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap sm:flex-nowrap justify-center w-full">
              {/* Mobile: Sort by and Filters side by side */}
              <div className="flex items-center gap-2 w-full sm:w-auto lg:hidden">
                <span className="text-xs sm:text-sm text-gray-900 font-semibold font-body whitespace-nowrap">{t('common.sort')}:</span>
                <div className="relative group flex-1">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#009744] bg-white text-xs sm:text-sm font-semibold font-poppins text-gray-900 cursor-pointer hover:border-[#009744] transition-all duration-300 shadow-sm hover:shadow-md w-full"
                  >
                    <option value="featured">{t('sort.featured')}</option>
                    <option value="price-low">{t('sort.priceLow')}</option>
                    <option value="price-high">{t('sort.priceHigh')}</option>
                    <option value="rating">{t('sort.rating')}</option>
                    <option value="newest">{t('sort.newest')}</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#009744] transition-colors">
                    <svg className="w-3 h-3 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
                <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 hover:border-[#009744] hover:bg-[#009744] hover:text-white transition-all duration-300 shadow-sm hover:shadow-md font-semibold font-poppins text-xs sm:text-sm"
                      aria-label="Open filters"
                    >
                      <Filter className="h-4 w-4" />
                      {t('common.filter')}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-full sm:w-[90vw] sm:max-w-md overflow-y-auto bg-white [&>button]:text-gray-900 [&>button]:hover:text-gray-700 flex flex-col">
                    <SheetHeader>
                      <SheetTitle className="text-left flex items-center gap-2 text-gray-900">
                        <Filter className="h-5 w-5 text-[#009744]" />
                        {t('common.filter')}
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-6 space-y-6 flex-1 overflow-y-auto pb-4">
                      {renderFilterContent()}
                    </div>
                    <div className="border-t border-gray-200 pt-4 mt-auto flex gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 border-gray-300 hover:bg-gray-50 font-semibold font-poppins"
                      >
                        {t('common.close')}
                      </Button>
                      <Button
                        onClick={() => setIsFilterOpen(false)}
                        className="flex-1 bg-[#009744] hover:bg-[#2E763B] text-white font-semibold font-poppins"
                      >
                        {t('common.applyFilters')}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
          {/* Filter Sidebar - Hidden on mobile, visible on desktop - Sticky */}
          <aside className="hidden lg:block w-full lg:w-72 shrink-0">
            <div className="sticky top-28 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              {renderFilterContent()}
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1 relative">
            {/* Results count and Sort By on same line */}
            <div className="mb-6 sm:mb-8 flex items-center justify-between flex-wrap gap-4">
              <p className="text-xs sm:text-sm text-gray-600 font-body">
                {t('common.showing')} <span className="font-semibold text-gray-900">{sortedProducts.length}</span> {t('common.of')}{" "}
                <span className="font-semibold text-gray-900">{allProducts.length}</span> {t('common.products')}
              </p>
              <div className="hidden lg:flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-gray-900 font-semibold font-body">{t('common.sort')}:</span>
                <div className="relative group">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="appearance-none px-3 py-2 pr-8 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-[#009744] bg-white text-xs sm:text-sm font-semibold font-poppins text-gray-900 cursor-pointer hover:border-[#009744] transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    <option value="featured">{t('sort.featured')}</option>
                    <option value="price-low">{t('sort.priceLow')}</option>
                    <option value="price-high">{t('sort.priceHigh')}</option>
                    <option value="rating">{t('sort.rating')}</option>
                    <option value="newest">{t('sort.newest')}</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 group-hover:text-[#009744] transition-colors">
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-4 md:gap-5 lg:gap-6">
              {sortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Product Modal */}
            <ProductModal
              product={selectedProduct}
              open={isModalOpen}
              onOpenChange={setIsModalOpen}
            />

            {/* No Results */}
            {sortedProducts.length === 0 && !loading && (
              <div className="text-center py-24 bg-white rounded-3xl border border-gray-100">
                <div className="max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Filter className="h-10 w-10 text-gray-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3 font-heading">
                    {t('productCategory.noProductsFound')}
                  </h3>
                  <p className="text-base text-gray-600 mb-8 font-body">
                    {t('productCategory.tryAdjusting')}
                  </p>
                  <Button
                    onClick={resetFilters}
                    className="bg-[#009744] hover:bg-[#2E763B] text-white font-bold rounded-full px-8 py-3 font-poppins"
                  >
                    {t('productCategory.clearAllFilters')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}


function ProductCard({ product }: { product: TransformedProduct }) {
  const { t, formatCurrency, convertCurrency } = useI18n();
  const { addItem, isInCart: checkInCart } = useCartStore();
  const [isAdding, setIsAdding] = useState(false);
  const router = useRouter();
  const { toggleWishlist, isInWishlist } = useWishlistStore();

  // State for selected variant
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants && product.variants.length > 0
      ? (product.variants.find(v => v.is_default)?.id || product.variants[0].id)
      : ""
  );

  const selectedVariant = product.variants?.find(v => v.id === selectedVariantId) || product.variants?.[0];

  // Determine price and stock based on selection
  const displayPrice = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
  const displayOriginalPrice = selectedVariant ? Number(selectedVariant.originalPrice) : Number(product.originalPrice);
  const displaySize = selectedVariant ? selectedVariant.size : product.packageSize;
  const inStock = selectedVariant ? (selectedVariant.stock > 0) : product.inStock;

  const isWishlisted = isInWishlist(product.id);
  // Pass variant ID to check specific item in cart if variant is selected
  const isInCart = checkInCart(product.id, selectedVariantId || undefined);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedVariant && (!product.variants || product.variants.length === 0)) {
       // Fallback for no variants
       setIsAdding(true);
       addItem({
        id: product.id,
        productId: product.id, // Always set productId for products without variants
        name: product.name,
        image: product.image,
        price: Number(product.price),
        originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
        packageSize: product.packageSize,
       });
        // Track AddToCart
        trackAddToCart({
          id: product.id,
          name: product.name,
          price: Number(product.price),
          quantity: 1,
        });

        setTimeout(() => setIsAdding(false), 1000);
        return;
    }

    if (selectedVariant) {
        setIsAdding(true);
        addItem({
            id: `${product.id}-${selectedVariant.id}`, // Unique ID for cart item
            productId: product.id,
            variantId: selectedVariant.id,
            name: `${product.name} - ${selectedVariant.size}`,
            image: product.image,
            price: Number(selectedVariant.price),
            originalPrice: selectedVariant.originalPrice ? Number(selectedVariant.originalPrice) : undefined,
            packageSize: selectedVariant.size,
        });
        // Track AddToCart
        trackAddToCart({
            id: product.id,
            name: product.name,
            price: Number(selectedVariant.price),
            quantity: 1,
        });

        setTimeout(() => setIsAdding(false), 1000);
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Track InitiateCheckout
    const price = selectedVariant ? Number(selectedVariant.price) : Number(product.price);
    trackInitiateCheckout(
        [{
            productId: product.id,
            price: price,
            quantity: 1,
        }],
        price
    );

    if (selectedVariant) {
        router.push(`/checkout?product=${product.id}&variant=${selectedVariant.id}`);
    } else {
        router.push(`/checkout?product=${product.id}`);
    }
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist({
      id: product.id,
      name: product.name,
      image: product.image,
      price: displayPrice,
      originalPrice: displayOriginalPrice,
      rating: product.rating,
      reviews: product.reviews,
    });
  };

  return (
    <Card className="group relative border-none shadow-sm hover:shadow-xl transition-all duration-500 rounded-2xl overflow-hidden bg-white h-full flex flex-col">
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
        {/* Badge */}
        {product.badge && (
          <div className="absolute top-2 xs:top-3 left-2 xs:left-3 z-20">
            <Badge
              className={cn(
                "rounded-full px-2 xs:px-3 py-0.5 xs:py-1 text-[10px] xs:text-xs font-bold shadow-sm backdrop-blur-md font-poppins",
                product.badge === "SALE" && "bg-red-500 text-white",
                product.badge === "HOT" && "bg-orange-500 text-white",
                product.badge === "NEW" && "bg-[#009744] text-white"
              )}
            >
              {product.badge === 'SALE' ? t('product.badge.sale') : product.badge === 'HOT' ? t('product.badge.hot') : t('product.badge.new')}
            </Badge>
          </div>
        )}

        {/* Wishlist Button */}
        <motion.div
            className="absolute top-2 xs:top-3 right-2 xs:right-3 z-20"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
          <Button
            size="icon"
            variant="ghost"
            onClick={handleWishlist}
            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm transition-colors"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={isWishlisted ? "active" : "inactive"}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Heart
                  className={cn(
                    "h-4 w-4 sm:h-5 sm:w-5 transition-colors",
                    isWishlisted ? "fill-pink-500 text-pink-500" : "text-gray-600"
                  )}
                />
              </motion.div>
            </AnimatePresence>
          </Button>
        </motion.div>

        {/* Product Image */}
        <Link href={getProductHref(product)} className="block h-full w-full">
            <div className="relative h-full w-full">
                <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                />
                 {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
            </div>
        </Link>

        {/* Quick View - Shows on hover (hidden on mobile) */}
        <div className="hidden sm:block absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pt-20 pb-5 px-5 pointer-events-none">
          <Link href={getProductHref(product)} className="pointer-events-auto">
            <div className="w-full bg-white hover:bg-gray-50 text-gray-900 font-semibold shadow-lg rounded-full h-11 font-poppins flex items-center justify-center cursor-pointer transition-colors">
              <Eye className="h-4 w-4 mr-2" />
              {t('product.viewDetails')}
            </div>
          </Link>
        </div>
      </div>

      <CardContent className="p-2.5 xs:p-3 sm:p-5 space-y-1.5 xs:space-y-2 sm:space-y-3 flex-1 flex flex-col">
        {/* Rating - Compact on mobile */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => {
              const isFilled = i < Math.floor(product.rating);
              const isHalfFilled = i === Math.floor(product.rating) && product.rating % 1 >= 0.5;
              return (
                <Star
                  key={i}
                  className={cn(
                    "h-2.5 xs:h-3 sm:h-4 w-2.5 xs:w-3 sm:w-4",
                    isFilled || isHalfFilled
                      ? "text-amber-400 fill-amber-400"
                      : "text-gray-200 fill-gray-200"
                  )}
                />
              );
            })}
          </div>
          <span className="text-[9px] xs:text-[10px] sm:text-sm text-gray-500 font-body">
            ({product.reviews})
          </span>
        </div>

        {/* Title - Compact on mobile */}
        <Link href={getProductHref(product)}>
            <h3 className="text-xs xs:text-sm sm:text-base font-semibold text-gray-900 line-clamp-3 h-[3.25rem] xs:h-[3.75rem] sm:h-[4.5rem] leading-tight font-poppins hover:text-[#009744] transition-colors">
            {product.name}
            </h3>
        </Link>

        {/* Variant Selector (If multiple variants exist) */}
        {product.variants && product.variants.length > 1 ? (
             <div className="flex flex-wrap gap-1.5 mt-1" onClick={(e) => e.preventDefault()}>
                {product.variants.sort((a,b) => (Number(a.price) - Number(b.price))).map((variant) => (
                    <button
                        key={variant.id}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedVariantId(variant.id);
                        }}
                        className={cn(
                            "text-[10px] xs:text-[11px] px-2 py-0.5 rounded-full border transition-all truncate max-w-full",
                            selectedVariantId === variant.id
                                ? "bg-[#009744] text-white border-[#009744]"
                                : "bg-white text-gray-600 border-gray-200 hover:border-[#009744]"
                        )}
                        title={variant.display_name || variant.size}
                    >
                        {variant.size}
                    </button>
                ))}
            </div>
        ) : (
             /* Single Variant / Package Size Display */
            <p className="text-[9px] xs:text-[10px] sm:text-sm text-gray-500 font-body">
            {displaySize}
            </p>
        )}


        {/* Price - Optimized for mobile */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 pt-0.5 mt-auto">
          <span className="text-sm xs:text-base sm:text-xl lg:text-2xl font-bold text-gray-900 font-poppins">
            {formatCurrency(displayPrice)}
          </span>
          {displayOriginalPrice && displayOriginalPrice > displayPrice && (
            <span className="text-[9px] xs:text-[10px] sm:text-sm text-gray-400 line-through font-body">
              {formatCurrency(displayOriginalPrice)}
            </span>
          )}
        </div>
      </CardContent>


      <CardFooter className="p-2.5 xs:p-3 sm:p-4 md:p-5 pt-0 sm:pt-0 sm:mt-auto shrink-0 flex flex-col gap-1.5 xs:gap-2 w-full">
        <div className="flex gap-1 xs:gap-1.5 sm:gap-2 w-full">
          <Button
            className={cn(
              "flex-1 font-bold rounded-full transition-all shadow-md hover:shadow-lg group/btn font-poppins",
              "h-8 xs:h-9 sm:h-10 md:h-12 text-[10px] xs:text-xs sm:text-sm px-1.5 xs:px-2 sm:px-4",
              "flex items-center justify-center gap-0.5 xs:gap-1",
              "bg-[#009744] hover:bg-[#2E763B] text-white",
              !inStock && "opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400"
            )}
            onClick={handleAddToCart}
            disabled={!inStock}
          >
            {isAdding ? (
              <>
                <Check className="h-2.5 xs:h-3 sm:h-4 w-2.5 xs:w-3 sm:w-4 animate-bounce shrink-0" />
                <span className="whitespace-nowrap hidden xs:inline">{t('product.addedToCart')}</span>
                <span className="whitespace-nowrap xs:hidden">Added</span>
              </>
            ) : isInCart ? (
              <>
                <Plus className="h-2.5 xs:h-3 sm:h-4 w-2.5 xs:w-3 sm:w-4 shrink-0 group-hover/btn:rotate-90 transition-transform" />
                <span className="whitespace-nowrap hidden xs:inline">{t('product.addMore')}</span>
                <span className="whitespace-nowrap xs:hidden">Add+</span>
              </>
            ) : inStock ? (
              <>
                <Plus className="h-2.5 xs:h-3 sm:h-4 w-2.5 xs:w-3 sm:w-4 shrink-0 group-hover/btn:rotate-90 transition-transform" />
                <span className="whitespace-nowrap hidden xs:inline">{t('product.addToCart')}</span>
                <span className="whitespace-nowrap xs:hidden">Add</span>
              </>
            ) : (
                <>
                <span className="whitespace-nowrap hidden xs:inline">{t('product.outOfStock')}</span>
                <span className="whitespace-nowrap xs:hidden">No Stock</span>
              </>
            )}
          </Button>
          <Button
            variant="outline"
            className={cn(
              "flex-1 font-bold rounded-full transition-all shadow-md hover:shadow-lg font-poppins",
              "h-8 xs:h-9 sm:h-10 md:h-12 text-[10px] xs:text-xs sm:text-sm px-1.5 xs:px-2 sm:px-4",
              "border-[#009744] text-[#009744] hover:bg-[#009744] hover:text-white",
              !inStock && "opacity-50 cursor-not-allowed border-gray-400 text-gray-400 hover:bg-transparent hover:text-gray-400"
            )}
            onClick={handleBuyNow}
            disabled={!inStock}
          >
            <span className="whitespace-nowrap hidden xs:inline">{t('product.buyNow')}</span>
            <span className="whitespace-nowrap xs:hidden">Buy</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
