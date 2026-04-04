"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/src/components/providers/i18n-provider";
import { trackViewContent, trackAddToCart, trackInitiateCheckout } from "@/src/utils/pixel";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Label } from "@/src/components/ui/label";
import {
  Star,
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Check,
  Zap,
  Truck,
  Shield,
  Award,
  Package,
  Leaf,
  Play,
  Pause,
  X
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { motion, AnimatePresence } from "framer-motion";
import { useCartStore } from "@/src/lib/cart-store";
import { useWishlistStore } from "@/src/lib/wishlist-store";
import { toast } from "sonner";

interface ProductVariant {
  id: string;
  size: string;
  weight?: string;
  display_name?: string;
  price: number;
  originalPrice?: number;
  stock: number;
}

interface Product {
  id: string;
  name: string;
  image: string;
  images?: string[];
  videos?: string[];
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  reviews: number;
  packageSize: string;
  origin: string;
  certifications: string[];
  inStock: boolean;
  onSale: boolean;
  badge?: "SALE" | "HOT" | "NEW";
  description?: string;
  variants?: ProductVariant[];
  slug?: string;
}

interface ProductModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductModal({ product, open, onOpenChange }: ProductModalProps) {
  const router = useRouter();
  const { t, formatCurrency, convertCurrency } = useI18n();
  const { addItem } = useCartStore();
  const { isInWishlist, toggleWishlist } = useWishlistStore();
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [showPlayButton, setShowPlayButton] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Get selected variant or first variant
  const selectedVariant = product?.variants?.find(v => v.id === selectedVariantId) || product?.variants?.[0];
  const displayPrice = selectedVariant?.price || product?.price || 0;
  const displayOriginalPrice = selectedVariant?.originalPrice || product?.originalPrice;

  // Combine images and videos into media array
  const allMedia = product ? [
    ...(product.images || [product.image]),
    ...(product.videos || []),
  ] : [];
  const selectedMedia = allMedia[selectedMediaIndex] || '';
  const isVideo = selectedMedia?.endsWith('.mp4');

  // Handle video play/pause
  const handleVideoToggle = () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
        setShowPlayButton(true);
      } else {
        videoRef.current.play();
        setIsVideoPlaying(true);
        setShowPlayButton(false);
      }
    }
  };

  // Auto-play video when selected
  useEffect(() => {
    if (isVideo && videoRef.current && open && product) {
      videoRef.current.play().then(() => {
        setIsVideoPlaying(true);
        setShowPlayButton(false);
      }).catch(() => {
        setIsVideoPlaying(false);
        setShowPlayButton(true);
      });
    } else if (!isVideo) {
      setIsVideoPlaying(false);
      setShowPlayButton(false);
    }
  }, [selectedMediaIndex, isVideo, open, product]);

  // Show play button on hover or when paused
  useEffect(() => {
    if (isVideo) {
      setShowPlayButton(!isVideoPlaying || isHovering);
    }
  }, [isVideoPlaying, isHovering, isVideo]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
      setIsVideoPlaying(false);
      setShowPlayButton(true);
      setSelectedMediaIndex(0);
      setQuantity(1);
      setImageLoaded(false);
    } else if (open && product) {
        // Track ViewContent when modal opens
        trackViewContent({
            id: product.id,
            name: product.name,
            price: selectedVariant?.price || product.price,
        });
    }
  }, [open, product?.id]);

  if (!product) return null;

  const discountPercentage = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : product.discount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-0 bg-white rounded-2xl border-0 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[calc(100vw-2rem)] sm:w-[calc(100vw-4rem)] md:w-full focus:outline-none">
        <VisuallyHidden>
          <DialogTitle>{t(product.name)}</DialogTitle>
        </VisuallyHidden>

        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white transition-all duration-200 hover:scale-105"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 max-h-[92vh] overflow-hidden">
          {/* Left: Image Gallery */}
          <div className="relative bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100 flex flex-col">
            {/* Badge */}
            {product.badge && (
              <div className="absolute top-5 left-5 z-20">
                <Badge
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-bold text-white shadow-lg uppercase tracking-widest",
                    product.badge === "SALE" && "bg-gradient-to-r from-red-500 to-red-600",
                    product.badge === "HOT" && "bg-gradient-to-r from-orange-500 to-amber-500",
                    product.badge === "NEW" && "bg-gradient-to-r from-emerald-500 to-green-600"
                  )}
                >
                  {product.badge}
                </Badge>
              </div>
            )}

            {/* Discount Badge */}
            {discountPercentage && discountPercentage > 0 && !product.badge && (
              <div className="absolute top-5 left-5 z-20">
                <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg uppercase tracking-wide">
                  -{discountPercentage}% OFF
                </Badge>
              </div>
            )}

            {/* Main Image Container */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-10 min-h-[280px] sm:min-h-[320px] lg:min-h-[380px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedMediaIndex}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="relative w-full h-full flex items-center justify-center"
                >
                  {isVideo ? (
                    <div
                      className="relative w-full h-full max-h-[320px] flex items-center justify-center group"
                      onMouseEnter={() => setIsHovering(true)}
                      onMouseLeave={() => setIsHovering(false)}
                    >
                      <video
                        ref={videoRef}
                        src={selectedMedia}
                        className="w-full h-full object-contain rounded-xl"
                        playsInline
                        autoPlay
                        muted
                        loop
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                      />
                      {showPlayButton && (
                        <button
                          onClick={handleVideoToggle}
                          className="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-all duration-200 rounded-xl"
                          aria-label={isVideoPlaying ? "Pause video" : "Play video"}
                        >
                          <div className="w-14 h-14 rounded-full bg-white/95 hover:bg-white flex items-center justify-center shadow-xl transition-all hover:scale-110">
                            {isVideoPlaying ? (
                              <Pause className="h-6 w-6 text-gray-900" fill="currentColor" />
                            ) : (
                              <Play className="h-6 w-6 text-gray-900 ml-1" fill="currentColor" />
                            )}
                          </div>
                        </button>
                      )}
                    </div>
                  ) : selectedMedia ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {/* Loading skeleton */}
                      {!imageLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-48 h-48 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl animate-pulse" />
                        </div>
                      )}
                      <img
                        src={selectedMedia}
                        alt={`${product.name}`}
                        className={cn(
                          "max-w-full max-h-[300px] w-auto h-auto object-contain drop-shadow-xl transition-opacity duration-300",
                          imageLoaded ? "opacity-100" : "opacity-0"
                        )}
                        onLoad={() => setImageLoaded(true)}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full max-h-[300px] flex items-center justify-center bg-gray-100 rounded-xl">
                      <Package className="h-16 w-16 text-gray-300" />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Thumbnail Gallery */}
            {allMedia.length > 1 && (
              <div className="px-6 pb-6 sm:px-8 sm:pb-8">
                <div className="flex gap-3 justify-center">
                  {allMedia.slice(0, 5).map((media, index) => {
                    const isVideoThumb = media.endsWith('.mp4');
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedMediaIndex(index);
                          setImageLoaded(false);
                        }}
                        className={cn(
                          "relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden transition-all duration-200",
                          selectedMediaIndex === index
                            ? "ring-2 ring-emerald-500 ring-offset-2 shadow-lg scale-105"
                            : "opacity-70 hover:opacity-100 hover:scale-105"
                        )}
                      >
                        {isVideoThumb ? (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                              <Play className="w-3 h-3 text-gray-700 ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={media}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Product Details */}
          <div className="flex flex-col overflow-y-auto max-h-[50vh] lg:max-h-[92vh] bg-white">
            <div className="p-6 sm:p-8 lg:py-8 lg:px-10 space-y-5">
              {/* Product Name */}
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight tracking-tight">
                {t(product.name)}
              </h2>

              {/* Origin & Size Tags */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                  <Leaf className="h-3 w-3" />
                  {product.origin}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                  <Package className="h-3 w-3" />
                  {product.packageSize}
                </span>
              </div>

              {/* Price Section */}
              <div className="flex items-baseline gap-3 py-2">
                <span className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight">
                  {formatCurrency(displayPrice)}
                </span>
                {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                  <span className="text-lg text-gray-400 line-through font-medium">
                    {formatCurrency(displayOriginalPrice)}
                  </span>
                )}
                {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                  <span className="text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                    Save {Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)}%
                  </span>
                )}
              </div>

              {/* Size / Variant Selection */}
              {product.variants && product.variants.length > 1 && (
                <div className="space-y-2">
                  <span className="text-sm font-semibold text-gray-700">Select Size:</span>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.map((variant) => (
                      <button
                        key={variant.id}
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={cn(
                          "px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all",
                          (selectedVariantId === variant.id || (!selectedVariantId && variant.id === product.variants?.[0]?.id))
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300",
                          variant.stock === 0 && "opacity-50 cursor-not-allowed line-through"
                        )}
                        disabled={variant.stock === 0}
                      >
                        <span>{variant.display_name || variant.size || variant.weight}</span>
                        <span className={cn("block text-xs mt-0.5",
                          (selectedVariantId === variant.id || (!selectedVariantId && variant.id === product.variants?.[0]?.id))
                            ? "text-white/80" : "text-gray-500"
                        )}>
                          {formatCurrency(variant.price)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              <p className="text-gray-500 text-sm leading-relaxed">
                {product.description
                  ? t(product.description)
                  : `Premium quality ${t(product.name).toLowerCase()} sourced directly from ${product.origin}. Carefully processed and packed to preserve natural flavor and nutrients.`}
              </p>

              {/* Rating & Reviews - Moved below description */}
              <div className="flex items-center gap-3 py-2 px-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-4 w-4",
                        i < Math.floor(product.rating)
                          ? "text-amber-400 fill-amber-400"
                          : i < product.rating
                          ? "text-amber-400 fill-amber-400/50"
                          : "text-gray-300 fill-gray-300"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-900">{product.rating.toFixed(1)}</span>
                <span className="text-sm text-gray-500">•</span>
                <button
                  onClick={() => {
                    onOpenChange(false);
                    const slug = product.slug || product.id;
                    router.push(`/products/${slug}#product-reviews`);
                  }}
                  className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline underline-offset-2 cursor-pointer transition-colors"
                >
                  {product.reviews} verified reviews
                </button>
              </div>

              {/* Certifications */}
              {product.certifications.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.certifications.map((cert) => (
                    <Badge
                      key={cert}
                      variant="outline"
                      className="bg-white text-emerald-700 border-emerald-200 px-3 py-1 text-xs font-medium"
                    >
                      <Check className="h-3 w-3 mr-1.5 text-emerald-500" />
                      {cert}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Quantity Selector - Improved UI */}
              <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl">
                <span className="text-sm font-semibold text-gray-700">Quantity</span>
                <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="h-10 w-10 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 rounded-l-lg border-r border-gray-200"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-14 text-center font-bold text-base text-gray-900 py-2">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="h-10 w-10 flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 rounded-r-lg border-l border-gray-200"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Action Buttons - Wishlist now uniform */}
              <div className="flex gap-3 pt-2">
                <Button
                  size="lg"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-12 rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 text-sm"
                  onClick={() => {
                      if (product && selectedVariant) {
                        // Add to cart store
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

                        toast.success(`${product.name} added to cart`);
                      }
                  }}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
                <Button
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-semibold h-12 rounded-xl shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 transition-all duration-300 text-sm"
                  onClick={() => {
                    if (product) {
                        // Track InitiateCheckout
                        const price = selectedVariant?.price || product.price;
                        trackInitiateCheckout(
                            [{
                                productId: product.id,
                                price: price,
                                quantity: quantity,
                            }],
                            price * quantity
                        );
                    }
                    router.push(`/checkout?product=${product.id}`);
                    onOpenChange(false);
                  }}
                >
                  <Zap className="h-5 w-5 mr-2" />
                  Buy Now
                </Button>
              </div>

              {/* Wishlist Button - Separate row, uniform with other elements */}
              <button
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={cn(
                  "w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all duration-200 text-sm font-medium",
                  isWishlisted
                    ? "bg-pink-50 border-pink-200 text-pink-600"
                    : "bg-white border-gray-200 text-gray-600 hover:border-pink-200 hover:text-pink-500 hover:bg-pink-50/50"
                )}
              >
                <Heart className={cn("h-5 w-5 transition-all", isWishlisted && "fill-current scale-110")} />
                <span>{isWishlisted ? "Added to Wishlist" : "Add to Wishlist"}</span>
              </button>

              {/* Trust Badges with Custom Icons */}
              <div className="grid grid-cols-3 gap-3 pt-4 mt-2 border-t border-gray-100">
                <div className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-gray-50/50">
                  <img
                    src="/images/icons/fast-delivery.png"
                    alt="Fast Delivery"
                    className="h-8 w-8 object-contain"
                  />
                  <span className="text-xs text-gray-600 font-medium leading-tight">Free Shipping</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-gray-50/50">
                  <img
                    src="/images/icons/quality.png"
                    alt="Quality Assured"
                    className="h-8 w-8 object-contain"
                  />
                  <span className="text-xs text-gray-600 font-medium leading-tight">Quality Assured</span>
                </div>
                <div className="flex flex-col items-center text-center gap-2 p-3 rounded-xl bg-gray-50/50">
                  <img
                    src="/images/icons/premium-quality.png"
                    alt="Premium Grade"
                    className="h-8 w-8 object-contain"
                  />
                  <span className="text-xs text-gray-600 font-medium leading-tight">Premium Grade</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
