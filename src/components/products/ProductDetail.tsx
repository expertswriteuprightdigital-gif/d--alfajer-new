"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Heart, Share2, Check, AlertCircle, Plus, Minus, Truck, Lock, RotateCcw, Sprout } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent } from "@/src/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/src/lib/cart-store";
import { useWishlistStore } from "@/src/lib/wishlist-store";
import { useI18n } from "@/src/components/providers/i18n-provider";
import { ProductReviews } from "./ProductReviews";
import { trackViewContent, trackAddToCart, trackInitiateCheckout } from "@/src/utils/pixel";


interface RelatedProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  originalPrice?: number;
  rating: number;
  reviews: number;
}

interface ProductDetailProps {
  productId?: string;
  initialProduct?: any;
  relatedProducts?: RelatedProduct[];
}

export function ProductDetail({ productId, initialProduct, relatedProducts = [] }: ProductDetailProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-12 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ProductDetailContent productId={productId} initialProduct={initialProduct} relatedProducts={relatedProducts} />;
}

function ProductDetailContent({ productId, initialProduct, relatedProducts = [] }: ProductDetailProps) {
  const router = useRouter();
  const { t, formatCurrency, convertCurrency, currency } = useI18n();
  const { addItem } = useCartStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();

  const product = useMemo(
    () => initialProduct,
    [initialProduct]
  );

  const [selectedVariantId, setSelectedVariantId] = useState(
    product?.variants[0]?.id || ""
  );
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Initialize wishlist status from store
  useEffect(() => {
    if (product) {
      setIsWishlisted(isInWishlist(product.id));
    }
  }, [product, isInWishlist]);

  // Track ViewContent on product load (once per mount/product change)
  useEffect(() => {
    if (product) {
        trackViewContent({
            id: product.id,
            name: product.name,
            price: selectedVariant?.price || product.price,
        });
    }
  }, [product?.id]);


  if (!product) {
    return <div className="p-8 text-center">{t("product.notFound")}</div>;
  }

  const selectedVariant = product.variants?.find(
    (v: { id: string; price: number; originalPrice?: number; stock: number }) => v.id === selectedVariantId
  );
  const rawPrice = selectedVariant?.price || product.price;
  const rawOriginalPrice = selectedVariant?.originalPrice || product.originalPrice;

  // Don't convert here - formatCurrency will handle conversion and formatting
  const displayPrice = rawPrice;
  const displayOriginalPrice = rawOriginalPrice;

  const handleAddToCart = () => {
    if (selectedVariant) {
      addItem({
        id: `${product.id}-${selectedVariant.id}`,
        productId: product.id,
        variantId: selectedVariant.id,
        name: `${product.name} - ${selectedVariant.size}`,
        image: product.image,
        price: selectedVariant.price,
        originalPrice: selectedVariant.originalPrice,
        packageSize: selectedVariant.size,
        quantity: quantity
      });
      
      // Track AddToCart
      trackAddToCart({
          id: product.id,
          name: product.name,
          price: selectedVariant.price,
          quantity: quantity,
      });

      setQuantity(1);
    }
  };


  const handleBuyNow = () => {
    if (selectedVariant) {
      // Track InitiateCheckout
      trackInitiateCheckout(
        [{
          productId: product.id,
          price: selectedVariant.price,
          quantity: quantity,
        }],
        selectedVariant.price * quantity
      );
      // Navigate to checkout with product ID (without adding to cart)
      router.push(`/checkout?product=${product.id}`);
    }
  };

  const handleWishlistToggle = () => {
    if (product) {
      toggleWishlist({
        id: product.id,
        name: product.name,
        image: product.image,
        price: selectedVariant?.price || product.price,
        originalPrice: selectedVariant?.originalPrice || product.originalPrice,
        rating: product.rating,
        reviews: product.reviews,
      });
      setIsWishlisted(!isWishlisted);
    }
  };

  return (
    <div className="w-full bg-white">
      {/* Breadcrumb Navigation */}
      <div className="max-w-7xl mx-auto px-4 py-4 border-b border-gray-200 pt-16 sm:pt-20 lg:pt-24">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <a href="/" className="hover:text-[#009744] transition-colors">{t('common.home')}</a>
          <span className="text-gray-400">/</span>
          <a href="/products" className="hover:text-[#009744] transition-colors">{t('common.products')}</a>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900 font-medium">{t(product.name) || product.name}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Image Gallery Section */}
          <div className="space-y-4">
            {/* Main Image */}
            <motion.div
              className="relative w-full aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-200"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <Image
                src={product.images?.[selectedImageIndex] || product.image || "/images/placeholder.jpg"}
                alt={product.name || "Product image"}
                fill
                className="object-cover"
                priority
              />
              {product.badge && (
                <motion.div
                  className="absolute top-4 left-4"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <Badge className="bg-[#AB1F23] hover:bg-[#8B1819] text-white">
                    {product.badge === 'SALE' ? t('product.badge.sale') : product.badge === 'HOT' ? t('product.badge.hot') : t('product.badge.new')}
                  </Badge>
                </motion.div>
              )}
            </motion.div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {(product.images || []).filter((img: string) => img && img.trim() !== "").map((img: string, idx: number) => (
                <motion.button
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`relative w-full aspect-square rounded-md overflow-hidden border-2 transition-all ${selectedImageIndex === idx
                    ? "border-[#009744] shadow-md"
                    : "border-gray-200 hover:border-gray-300"
                    }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Image
                    src={img || "/images/placeholder.jpg"}
                    alt={`${product.name || "Product"}-${idx}`}
                    fill
                    className="object-cover"
                  />
                </motion.button>
              ))}
            </div>
          </div>

          {/* Product Information Section */}
          <div className="space-y-8">
            {/* Title & Rating */}
            <div className="space-y-4">
              <h1 className="text-4xl font-bold text-gray-900 leading-tight">
                {t(product.name) || product.name}
              </h1>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={18}
                        className={
                          i < Math.floor(product.rating)
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-300"
                        }
                      />
                    ))}
                  </div>
                  <span className="font-semibold text-gray-900">{product.rating}</span>
                </div>
                <div className="w-px h-6 bg-gray-300"></div>
                <button
                  onClick={() => document.getElementById('product-reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="text-gray-600 hover:text-[#009744] transition-colors cursor-pointer underline-offset-2 hover:underline"
                >
                  {product.reviews} {t('product.reviews')}
                </button>
              </div>
            </div>

            {/* Price Section */}
            <div className="bg-gradient-to-br from-gray-50 to-white p-6 rounded-lg border border-gray-200 space-y-3">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-gray-900">
                  {formatCurrency(displayPrice)}
                </span>
                {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                  <span className="text-xl text-gray-400 line-through">
                    {formatCurrency(displayOriginalPrice)}
                  </span>
                )}
              </div>
              {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                <div className="flex items-center gap-2">
                  <Badge className="bg-[#AB1F23] hover:bg-[#8B1819] text-white">
                    {t('product.discount')} {Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)}%
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {t('product.youSave')} {formatCurrency(displayOriginalPrice - displayPrice)}
                  </span>
                </div>
              )}
            </div>

            {/* Stock Status */}
            <div className="flex items-center gap-3">
              {selectedVariant && selectedVariant.stock > 0 ? (
                <>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-green-700 font-medium">{t('product.inStock')}</span>
                  <span className="text-gray-600 text-sm">({selectedVariant.stock} {t('common.available')})</span>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-red-700 font-medium">{t('product.outOfStock')}</span>
                </>
              )}
            </div>

            {/* Size / Variant Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-900">
                  {t('product.selectSize') || 'Select Size'}
                </label>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((variant: { id: string; size: string; weight?: string; display_name?: string; price: number; stock: number }) => (
                    <motion.button
                      key={variant.id}
                      onClick={() => setSelectedVariantId(variant.id)}
                      className={`px-5 py-3 rounded-xl border-2 text-sm font-medium transition-all ${selectedVariantId === variant.id
                        ? "border-[#009744] bg-[#009744] text-white shadow-lg"
                        : "border-gray-200 bg-white text-gray-900 hover:border-[#009744] hover:bg-green-50"
                        } ${variant.stock === 0 ? "opacity-50 cursor-not-allowed line-through" : ""}`}
                      disabled={variant.stock === 0}
                      whileHover={{ scale: variant.stock > 0 ? 1.03 : 1 }}
                      whileTap={{ scale: variant.stock > 0 ? 0.97 : 1 }}
                    >
                      <div className="font-semibold">{variant.display_name || variant.size || variant.weight}</div>
                      <div className={`text-xs mt-1 ${selectedVariantId === variant.id ? "text-white/80" : "text-gray-500"}`}>
                        {formatCurrency(variant.price)}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-900">
                {t('product.quantity')}
              </label>
              <div className="flex items-center gap-0 w-fit border border-gray-300 rounded-lg">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-12 w-12 rounded-none hover:bg-gray-100"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus size={18} className="text-gray-900" />
                </Button>
                <div className="w-12 text-center font-semibold text-gray-900 text-lg">
                  {quantity}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-12 w-12 rounded-none hover:bg-gray-100 border-l border-gray-300"
                  onClick={() => {
                    if (selectedVariant && quantity < selectedVariant.stock) {
                      setQuantity(quantity + 1);
                    }
                  }}
                  disabled={!selectedVariant || quantity >= selectedVariant.stock}
                >
                  <Plus size={18} className="text-gray-900" />
                </Button>
              </div>
              {selectedVariant && (
                <p className="text-xs text-gray-600">
                  {selectedVariant.stock - quantity} {t('common.itemsLeft') || 'items left in stock'}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    className="w-full bg-[#009744] hover:bg-[#007A37] text-white font-semibold h-12 rounded-lg"
                    onClick={handleAddToCart}
                    disabled={!selectedVariant || selectedVariant.stock === 0}
                  >
                    {t('product.addToCart')}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    size="lg"
                    className="w-full bg-[#AB1F23] hover:bg-[#8B1819] text-white font-semibold h-12 rounded-lg"
                    onClick={handleBuyNow}
                    disabled={!selectedVariant || selectedVariant.stock === 0}
                  >
                    {t('product.buyNow')}
                  </Button>
                </motion.div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full bg-white border-2 border-gray-300 text-gray-900 hover:bg-gray-100 font-semibold h-12 rounded-lg"
                    onClick={handleWishlistToggle}
                  >
                    <Heart
                      size={20}
                      className={isWishlisted ? "fill-[#AB1F23] text-[#AB1F23]" : "text-gray-900"}
                    />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full bg-white border-2 border-gray-300 text-gray-900 hover:bg-gray-100 font-semibold h-12 rounded-lg"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: product.name,
                          text: product.longDescription,
                          url: window.location.href,
                        });
                      }
                    }}
                  >
                    <Share2 size={20} className="text-gray-900" />
                  </Button>
                </motion.div>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Truck size={24} className="text-[#009744]" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Free Shipping</p>
                <p className="text-xs text-gray-600 mt-1">Above min. shipping value</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Lock size={24} className="text-[#009744]" />
                </div>
                <p className="text-sm font-semibold text-gray-900">{t('product.securePayment')}</p>
                <p className="text-xs text-gray-600 mt-1">{t('product.ssl')}</p>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Sprout size={24} className="text-[#009744]" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Farmer Direct</p>
                <p className="text-xs text-gray-600 mt-1">Freshly Sourced from Farmers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-12">
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-white border-b border-gray-200 rounded-none h-auto p-0">
              <TabsTrigger
                value="details"
                className="text-gray-900 font-semibold py-4 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-[#009744] data-[state=active]:bg-transparent data-[state=active]:text-[#009744] hover:text-[#009744] transition-colors"
              >
                {t('product.details') || 'Details'}
              </TabsTrigger>
              <TabsTrigger
                value="nutrition"
                className="text-gray-900 font-semibold py-4 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-[#009744] data-[state=active]:bg-transparent data-[state=active]:text-[#009744] hover:text-[#009744] transition-colors"
              >
                {t('product.nutrition')}
              </TabsTrigger>
              <TabsTrigger
                value="allergens"
                className="text-gray-900 font-semibold py-4 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-[#009744] data-[state=active]:bg-transparent data-[state=active]:text-[#009744] hover:text-[#009744] transition-colors"
              >
                {t('product.allergens') || 'Allergens'}
              </TabsTrigger>
              <TabsTrigger
                value="wholesale"
                className="text-gray-900 font-semibold py-4 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-[#009744] data-[state=active]:bg-transparent data-[state=active]:text-[#009744] hover:text-[#009744] transition-colors"
              >
                {t('product.wholesale') || 'Wholesale'}
              </TabsTrigger>
            </TabsList>

            {/* Details Tab (was Description) */}
            <TabsContent value="details" className="py-8 space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{t('product.aboutProduct')}</h3>
                <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">{t(product.longDescription)}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-3 text-lg">{t('product.origin')}</h4>
                  <p className="text-gray-700">
                    {t(`origin.${product.origin.toLowerCase().replace(/[,\s]+/g, '')}`) || product.origin}
                  </p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-3 text-lg">{t('product.certifications')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {(product.certifications || []).map((cert: string) => (
                      <Badge
                        key={cert}
                        variant="outline"
                        className="text-[#009744] border-[#009744] bg-green-50 hover:bg-green-100"
                      >
                        {t(`cert.${cert.toLowerCase().replace(/[\s-]+/g, '')}`) || cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {(product.ingredients?.length || 0) > 0 && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h4 className="font-bold text-gray-900 mb-4 text-lg">{t('product.ingredients')}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(product.ingredients || []).map((ing: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-[#009744] flex-shrink-0"></div>
                        <span className="text-gray-700">{t(ing) || ing}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Nutrition Tab */}
            <TabsContent value="nutrition" className="py-8 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('product.nutritionInfo')}</h3>
                <p className="text-gray-600">{t('product.perServing')}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-900 font-medium">{t('product.calories')}</span>
                    <span className="font-bold text-gray-900">{product.nutritionFacts.calories} kcal</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-900 font-medium">{t('product.protein')}</span>
                    <span className="font-bold text-gray-900">{product.nutritionFacts.protein}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-900 font-medium">{t('product.fat')}</span>
                    <span className="font-bold text-gray-900">{product.nutritionFacts.fat}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-200">
                    <span className="text-gray-900 font-medium">{t('product.carbohydrates')}</span>
                    <span className="font-bold text-gray-900">{product.nutritionFacts.carbs}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-gray-900 font-medium">{t('product.fiber')}</span>
                    <span className="font-bold text-gray-900">{product.nutritionFacts.fiber}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Allergens Tab */}
            <TabsContent value="allergens" className="py-8 space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-6">{t('product.allergens') || 'Allergens'}</h3>
              </div>
              {(product.allergenInfo && product.allergenInfo.length > 0) ? (
                <div className="bg-red-50 p-6 rounded-lg border border-red-100">
                  <div className="flex items-start gap-4">
                    <AlertCircle className="text-red-600 mt-1" />
                    <div>
                      <h4 className="font-bold text-red-900 mb-2">Contains the following allergens:</h4>
                      <ul className="list-disc pl-5 space-y-1 text-red-800">
                        {product.allergenInfo.map((a: string) => <li key={a} className="capitalize">{a}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 p-6 rounded-lg border border-green-100 flex items-center gap-4">
                  <Check className="text-green-600" />
                  <p className="text-green-800 font-medium">No common allergens listed.</p>
                </div>
              )}
            </TabsContent>

            {/* Wholesale Tab */}
            <TabsContent value="wholesale" className="py-8 space-y-6">
              <div className="bg-gray-50 p-8 rounded-lg text-center">
                <Truck className="mx-auto h-12 w-12 text-[#009744] mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('product.wholesale') || 'Wholesale Inquiries'}</h3>
                <p className="text-gray-600 mb-6 max-w-lg mx-auto">
                  Interested in buying in bulk? We offer competitive wholesale pricing for restaurants, retailers, and distributors.
                </p>
                <Button className="bg-[#009744] hover:bg-[#007A37]">Contact Wholesale Team</Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Reviews Section - Below Tabs */}
        <div id="product-reviews" className="border-t border-gray-200 mt-16 pt-16 scroll-mt-24">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">{t('product.customerReviews') || 'Customer Reviews'}</h2>
          <ProductReviews productId={product.id} />
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-gray-200 mt-16 pt-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">{t('product.relatedProducts')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.filter(p => p.id !== productId).slice(0, 4).map((relatedProduct) => (
                <motion.div
                  key={relatedProduct.id}
                  className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                  whileHover={{ y: -4 }}
                  onClick={() => {
                  const slug = relatedProduct.slug && String(relatedProduct.slug).trim();
                  const catName = (relatedProduct as { category?: { name?: string } }).category?.name?.toLowerCase();
                  const useSlug = slug && slug !== "undefined" && (!catName || slug.toLowerCase() !== catName);
                  router.push(`/products/${useSlug ? slug : relatedProduct.id}`);
                }}
                >
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    <Image
                      src={relatedProduct.image || "/images/placeholder.jpg"}
                      alt={relatedProduct.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                      {relatedProduct.name}
                    </h3>
                    <div className="flex items-center gap-1 mb-3">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            className={i < Math.floor(relatedProduct.rating) ? "fill-amber-400 text-amber-400" : "text-gray-300"}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-gray-600">({relatedProduct.reviews})</span>
                    </div>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="font-bold text-gray-900">{formatCurrency(relatedProduct.price)}</span>
                      {relatedProduct.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">{formatCurrency(relatedProduct.originalPrice)}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-[#009744] hover:bg-[#007A37] text-white font-semibold"
                    >
                      {t('product.viewDetails')}
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
