"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, AlertCircle, Check, Truck, Zap, Package, Shield, Star, ShoppingBag, ArrowRight, Home } from "lucide-react";
import { getSupabaseClient } from "@/src/lib/supabase/client";
import { FullPageLoader } from "@/src/components/ui/loader";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { Badge } from "@/src/components/ui/badge";
import { useCartStore } from "@/src/lib/cart-store";
import { useI18n } from "@/src/components/providers/i18n-provider";
import { useAuth } from "@/src/lib/auth-context";
import { trackInitiateCheckout, trackPurchase } from "@/src/utils/pixel";


import {
  paymentMethods,
  validatePromoCode,
  getCurrencyByCountry,
  countryCodes,
  type ShippingAddress,
} from "@/src/lib/checkout";
import {
  calculateShippingCost,
  fetchPincodeDetails,
  getAvailableShippingOptions,
  FREE_SHIPPING_THRESHOLD,
  type ShippingCalculationResult,
} from "@/src/lib/shipping";
import { toast } from "sonner";
import { loadRazorpayScript, openRazorpayCheckout, verifyRazorpayPayment } from "@/src/lib/razorpay";
import { getStoreSetting } from "@/src/lib/supabase/admin";

export function CheckoutPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render until client-side hydration is complete
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
          </div>
        </div>
      </div>
    );
  }

  return <CheckoutPageContent />;
}

function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, formatCurrency, convertCurrency } = useI18n();
  const { items, getTotalPrice, clearCart, addItem } = useCartStore();
  const { user } = useAuth();

  // Track which product+variant we've already added using sessionStorage to persist across re-renders
  const processedProductKey = 'buyNowProcessedProduct';
  const isBuyNowMode = !!searchParams.get('product');

  // Handle product from Buy Now button
  useEffect(() => {
    const productId = searchParams.get('product');
    const variantId = searchParams.get('variant');

    if (!productId) return;

    // Create a unique key for this product+variant combo
    const productKey = variantId ? `${productId}-${variantId}` : productId;

    // Get the stored processed product from sessionStorage (survives page reload but clears on new tab)
    const storedProcessed = sessionStorage.getItem(processedProductKey);

    // Debug: Log what's happening
    console.log('Buy Now Debug:', {
      productId,
      variantId,
      productKey,
      storedProcessed,
      currentCartItems: items.length,
      cartItemIds: items.map(i => i.id)
    });

    // Skip if we've already processed this exact product+variant in this session
    if (storedProcessed === productKey) {
      console.log('Product already processed in session, skipping');
      return;
    }

    // IMPORTANT: Mark as processed IMMEDIATELY before async operation
    // This prevents React StrictMode from running the effect twice and adding the item twice
    sessionStorage.setItem(processedProductKey, productKey);

    // Clear cart for Buy Now mode - user wants to buy only this product
    clearCart();
    console.log('Cart cleared for Buy Now mode');

    // For Buy Now, we always add the product since we just cleared the cart
    const fetchProduct = async () => {
        try {
          // Dynamic import to avoid circular dependencies
          const { getSupabaseClient } = await import("@/src/lib/supabase/client");
          const supabase = getSupabaseClient();
          const { data: product, error } = await supabase
            .from('products')
            .select('*, variants:product_variants(*)')
            .eq('id', productId)
            .single();

          if (product && !error) {
            let selectedVariant: any = null;
            if (variantId && product.variants) {
                selectedVariant = product.variants.find((v: any) => v.id === variantId);
            }

            if (selectedVariant) {
                 console.log('Adding variant to cart:', { productId, variantId, variantPrice: selectedVariant.price });
                 addItem({
                  id: `${product.id}-${selectedVariant.id}`,
                  productId: product.id,
                  variantId: selectedVariant.id,
                  name: `${product.name} - ${selectedVariant.weight}`,
                  price: selectedVariant.price,
                  image: product.images?.[0] || '/images/placeholder.png',
                  packageSize: selectedVariant.weight || 'Standard',
                }, false);
            } else {
                // If no specific variant, use first variant or base_price
                const firstVariant = product.variants?.[0];
                if (firstVariant) {
                  console.log('Adding first variant to cart:', { productId, firstVariantId: firstVariant.id, price: firstVariant.price });
                  addItem({
                    id: `${product.id}-${firstVariant.id}`,
                    productId: product.id,
                    variantId: firstVariant.id,
                    name: `${product.name} - ${firstVariant.weight}`,
                    price: firstVariant.price,
                    image: product.images?.[0] || '/images/placeholder.png',
                    packageSize: firstVariant.weight || 'Standard',
                  }, false);
                } else {
                  console.log('Adding base product to cart:', { productId, basePrice: product.base_price });
                  addItem({
                    id: product.id,
                    productId: product.id,
                    name: product.name,
                    price: product.base_price || 0,
                    image: product.images?.[0] || '/images/placeholder.png',
                    packageSize: 'Standard',
                  }, false);
                }
            }

            // Already marked as processed at the start of the effect
            console.log('Successfully added product to cart');
          }
        } catch (error) {
          console.error("Error fetching product for buy now:", error);
        }
      };

      fetchProduct();
  }, [searchParams]); // Only depend on searchParams, not items or addItem

  // Checkout State
  const [step, setStep] = useState<'shipping' | 'payment' | 'review'>('shipping');
  const [shippingAddress, setShippingAddress] = useState<Partial<ShippingAddress>>({});
  const [billingAddress, setBillingAddress] = useState<Partial<ShippingAddress>>({});
  const [useSameAddress, setUseSameAddress] = useState(true);
  const [paymentMethodId, setPaymentMethodId] = useState('card');

  // Get currency based on selected country
  const selectedCurrency = getCurrencyByCountry(shippingAddress.country || 'IN');
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    type: 'percentage' | 'fixed';
  } | null>(null);
  const [giftMessage, setGiftMessage] = useState('');
  const [subscribe, setSubscribe] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [shippingOptionId, setShippingOptionId] = useState<string>("standard");
  const [shippingDetails, setShippingDetails] = useState<ShippingCalculationResult | null>(null);
  const [fetchingPincode, setFetchingPincode] = useState(false);
  const [codEnabled, setCodEnabled] = useState<boolean>(true);

  // Success page state
  const [confirmedOrderItems, setConfirmedOrderItems] = useState<any[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<any[]>([]);

  // Fetch recommended products on successful order
  useEffect(() => {
    if (orderNumber) {
        const fetchRecommendations = async () => {
            try {
                const supabase = getSupabaseClient();
                // Get 4 random products (simulated by random range or just limit)
                const { data } = await supabase.from('products').select('*').limit(4);
                if (data) setRecommendedProducts(data);
            } catch(e) { console.error("Error fetching recommendations", e); }
        };
        fetchRecommendations();
    }
  }, [orderNumber]);

  // Fetch COD setting on mount
  useEffect(() => {
    async function fetchCodSetting() {
      try {
        const value = await getStoreSetting('enable_cod');
        setCodEnabled(value === true || value === 'true' || value === null);
      } catch (error) {
        console.error('Error fetching COD setting:', error);
        setCodEnabled(true); // Default to enabled on error
      }
    }
    fetchCodSetting();
  }, []);

  // Track InitiateCheckout on page mount (once)
  useEffect(() => {
    if (items.length > 0) {
      trackInitiateCheckout(
        items.map(item => ({
          productId: item.productId,
          price: item.price,
          quantity: item.quantity || 1
        })),
        getTotalPrice()
      );
    }
  }, []); // Only on mount


  // Filter payment methods based on COD setting
  const availablePaymentMethods = useMemo(() => {
    if (codEnabled) {
      return paymentMethods;
    }
    return paymentMethods.filter(method => method.type !== 'cod');
  }, [codEnabled]);

  // Calculate totals
  const subtotal = getTotalPrice();

  let discountAmount = 0;
  if (appliedPromo) {
    discountAmount =
      appliedPromo.type === 'percentage'
        ? (subtotal * appliedPromo.discount) / 100
        : appliedPromo.discount;
  }

  const subtotalAfterDiscount = subtotal - discountAmount;
  const total = subtotalAfterDiscount + shippingCost;

  // Handle promo code
  const handleApplyPromo = async () => {
    setPromoError('');
    setIsProcessing(true);
    try {
      const validation = await validatePromoCode(promoCode);
      if (!validation.valid) {
        setPromoError(t('checkout.invalidPromo'));
        return;
      }
      setAppliedPromo({
        code: promoCode.toUpperCase(),
        discount: validation.discount!,
        type: validation.type!,
      });
      setPromoCode('');
      toast(t('checkout.couponApplied'));
    } catch (error) {
      setPromoError(t('checkout.errorPromo'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Validate shipping address
  const isShippingAddressValid = useMemo(() => {
    return (
      shippingAddress.firstName &&
      shippingAddress.lastName &&
      shippingAddress.email &&
      shippingAddress.phone &&
      shippingAddress.streetAddress &&
      shippingAddress.city &&
      shippingAddress.state &&
      shippingAddress.postalCode &&
      shippingAddress.country
    );
  }, [shippingAddress]);

  // Calculate shipping cost when address changes
  useEffect(() => {
    if (!shippingAddress.country) {
      setShippingCost(0);
      setShippingDetails(null);
      return;
    }

    // Calculate total item count and weight
    const totalItemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalWeight = items.reduce((sum, item) => sum + (item.quantity || 1) * 0.5, 0) || 0.5;

    if (totalItemCount <= 0) {
      setShippingCost(0);
      setShippingDetails(null);
      return;
    }

    setCalculatingShipping(true);

    // Use the new zone-based shipping calculation
    const result = calculateShippingCost(
      shippingAddress.country || 'IN',
      shippingAddress.state || '',
      totalItemCount,
      totalWeight,
      subtotal,
      selectedCurrency,
      shippingOptionId
    );

    setShippingDetails(result);
    setShippingCost(result.totalShippingCost);
    setCalculatingShipping(false);
  }, [
    shippingAddress.country,
    shippingAddress.state,
    items,
    subtotal,
    selectedCurrency,
    shippingOptionId,
  ]);

  // Auto-fetch city, state, and country from pincode
  useEffect(() => {
    const fetchData = async () => {
      const pincode = shippingAddress.postalCode;
      // Default to 'IN' if no country is selected to try Indian pincodes first
      const countryCode = shippingAddress.country || 'IN';

      if (pincode && pincode.length >= 3) {
        setFetchingPincode(true);
        try {
          const details = await fetchPincodeDetails(pincode, countryCode);
          if (details) {
            setShippingAddress((prev) => ({
              ...prev,
              city: details.city || prev.city,
              state: details.state || prev.state,
              country: details.countryCode || prev.country,
            }));
          }
        } catch (error) {
          console.error('Error fetching pincode details:', error);
        } finally {
          setFetchingPincode(false);
        }
      }
    };

    const timeoutId = setTimeout(fetchData, 800);
    return () => clearTimeout(timeoutId);
  }, [shippingAddress.postalCode, shippingAddress.country]);

  // Scroll to top on step change or order confirmation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, orderNumber]);

  // Handle proceed
  const handleProceed = () => {
    if (step === 'shipping' && !isShippingAddressValid) {
      alert('Please fill all shipping fields');
      return;
    }
    if (step === 'payment') {
      setStep('review');
      return;
    }
    if (step === 'review') {
      handlePlaceOrder();
    }
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items,
          email: shippingAddress.email,
          name: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
          address: shippingAddress,
          phone: shippingAddress.countryCode ? `${shippingAddress.countryCode} ${shippingAddress.phone}` : shippingAddress.phone,
          paymentMethod: paymentMethodId,
          userId: user?.id,
          giftMessage,
          subscription: subscribe ? { enabled: true, frequency: 'monthly' } : null,
          promoCode: appliedPromo?.code,
          currency: selectedCurrency,
          shippingCost: shippingCost, // Include calculated shipping cost
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to place order: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle Razorpay Payment
      if (data.payment && data.payment.gateway === 'razorpay') {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          toast.error('Razorpay SDK failed to load');
          setIsProcessing(false);
          return;
        }

        openRazorpayCheckout({
          key: data.payment.razorpayKeyId,
          amount: data.payment.amount,
          currency: data.payment.currency,
          name: "Alfajer",
          description: `Order #${data.orderNumber}`,
          order_id: data.payment.razorpayOrderId,
          prefill: {
            name: shippingAddress.firstName ? `${shippingAddress.firstName} ${shippingAddress.lastName || ''}`.trim() : undefined,
            email: shippingAddress.email || undefined,
            contact: shippingAddress.phone || undefined,
          },
          handler: async (response) => {
            try {
              toast.loading('Verifying payment...');
              const result = await verifyRazorpayPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature,
                data.orderId
              );

              if (result.success) {
                toast.dismiss();
                toast.success('Payment successful!');
                toast.success('Payment successful!');
                setConfirmedOrderItems([...items]); // Save items to show in success screen
                setConfirmedTotal(total);
                setOrderNumber(data.orderNumber);
                
                // Track Purchase
                trackPurchase(
                    items.map(item => ({
                        productId: item.productId,
                        price: item.price,
                        quantity: item.quantity || 1
                    })),
                    total,
                    data.orderNumber
                );

                clearCart();
                setIsProcessing(false);

              } else {
                toast.dismiss();
                toast.error(result.error || 'Payment verification failed. Please contact support if payment was deducted.');
                setIsProcessing(false);
              }
            } catch (error: any) {
              toast.dismiss();
              console.error('Payment handler error:', error);
              toast.error('An error occurred during payment verification. Please contact support.');
              setIsProcessing(false);
            }
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
              toast.error("Payment cancelled");
            }
          }
        });
        return;
      }

      // If non-Razorpay or Mock
      const newOrderNumber = data.orderNumber || 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
      setConfirmedOrderItems([...items]); // Save items to show in success screen
      setConfirmedTotal(total);
      setOrderNumber(newOrderNumber);

      // Track Purchase
      trackPurchase(
          items.map(item => ({
              productId: item.productId,
              price: item.price,
              quantity: item.quantity || 1
          })),
          total,
          newOrderNumber
      );

      // Clear cart
      clearCart();
      setIsProcessing(false);


    } catch (error) {
      console.error('Checkout error:', error);
      alert('There was an error placing your order. Please try again.');
      setIsProcessing(false);
    }
  };


  // Order Confirmation - Inline on the same page
  if (orderNumber) {
    return (
      <div className="min-h-screen bg-gray-50 pt-36 pb-16 text-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Success Header */}
          <div className="text-center mb-10">
            <div className="relative mx-auto w-24 h-24 mb-6">
              <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20"></div>
              <div className="absolute inset-[-8px] bg-green-50 rounded-full"></div>
              <div className="relative w-24 h-24 bg-gradient-to-br from-[#009744] to-[#007f39] rounded-full flex items-center justify-center shadow-xl shadow-green-300/40">
                <Check className="w-12 h-12 text-white stroke-[3]" />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Order Placed Successfully!</h1>
            <p className="text-gray-500 text-sm sm:text-base">Thank you for shopping with Alfajer</p>
          </div>

          {/* Main Content - Two column on desktop */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

            {/* Left: Order Info */}
            <div className="lg:col-span-2 space-y-4">
              {/* Order Number Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">{t('checkout.orderNumber')}</p>
                <p className="text-xl font-bold text-gray-900 tracking-tight">{orderNumber}</p>
              </div>

              {/* Email Confirmation Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-1">Confirmation sent to</p>
                <p className="text-sm font-semibold text-gray-700">{shippingAddress.email}</p>
              </div>

              {/* Shipping Address Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Shipping to</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {shippingAddress.firstName} {shippingAddress.lastName}<br />
                  {shippingAddress.streetAddress}<br />
                  {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                </p>
              </div>

              {/* Continue Shopping Button */}
              <Button
                size="lg"
                className="w-full bg-[#009744] hover:bg-[#007f39] text-white font-bold h-14 rounded-2xl text-base shadow-lg shadow-green-200/50 transition-all hover:shadow-xl hover:shadow-green-200/60 hover:-translate-y-0.5 flex items-center justify-center gap-2"
                onClick={() => router.push('/')}
              >
                <Home className="w-5 h-5" />
                Continue Shopping
              </Button>
            </div>

            {/* Right: Items Ordered */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden h-full">
                <div className="bg-gray-50 border-b border-gray-100 px-6 py-3.5">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <ShoppingBag className="w-4 h-4 text-[#009744]" />
                    Items Ordered
                  </h3>
                </div>
                <div className="px-6 py-4 space-y-0 divide-y divide-gray-50">
                  {confirmedOrderItems.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center py-3.5 first:pt-1">
                      <div className="h-16 w-16 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0">
                        <img src={item.image || "/images/placeholder.png"} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm leading-snug truncate">{t(item.name)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                      </div>
                      <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 px-6 py-4 bg-gray-50/50 flex justify-between items-center">
                  <p className="font-semibold text-gray-900">Total Paid</p>
                  <p className="text-2xl font-bold text-[#009744]">{formatCurrency(confirmedTotal)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Products */}
          {recommendedProducts.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Recommended For You</h2>
                <button onClick={() => router.push('/products')} className="text-[#009744] font-semibold text-sm flex items-center gap-1 hover:underline">
                  View All <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {recommendedProducts.map((product) => (
                  <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer" onClick={() => router.push(`/product/${product.id}`)}>
                    <div className="aspect-square bg-gray-50 relative">
                      <img src={product.images?.[0] || "/images/placeholder.png"} alt={product.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <h3 className="font-semibold text-gray-900 text-sm truncate">{product.name}</h3>
                      <div className="flex items-center gap-1 my-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span className="text-xs text-gray-500">4.8</span>
                      </div>
                      <p className="font-bold text-[#009744] text-sm">₹{product.base_price || 0}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    // If we have a product param (Buy Now mode), show loader instead of empty cart
    // This handles the split second between clearCart() and adding the new item
    if (isBuyNowMode) {
      return <FullPageLoader />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-white dark:bg-white text-center">
        <Card className="w-full max-w-md bg-white dark:bg-white border-none shadow-none">
          <CardContent className="pt-6">
             <div className="mx-auto w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                 <ShoppingBag className="w-10 h-10 text-gray-300" />
             </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-900">{t('cart.empty')}</h2>
            <p className="text-gray-500 mb-8">Looks like you haven't added anything to your cart yet.</p>
            <Button className="w-full h-12 rounded-xl bg-[#009744] hover:bg-[#2E763B] text-white font-semibold" onClick={() => router.push('/')}>
               {t('checkout.continueShopping')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-6 xs:py-7 sm:py-8 md:py-10 dark:bg-white text-gray-900">
      <div className="max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 md:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-4 xs:gap-5 sm:gap-6 md:gap-8">
        <h1 className="col-span-full text-2xl xs:text-3xl sm:text-4xl font-bold mb-3 xs:mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 text-gray-900">
          <span className="text-[#009744]">{t('checkout.security') || 'Secure'}</span> <span className="text-[#AB1F23]">{t('checkout.title')}</span>
          <div className="flex-1 h-[2px] bg-gradient-to-r from-[#009744] to-[#AB1F23] w-full sm:ml-4 sm:w-auto"></div>
        </h1>
        {/* Main Checkout Form */}
        <div className="lg:col-span-2">
          <Tabs value={step} onValueChange={(v) => setStep(v as any)} className="space-y-4 xs:space-y-5 sm:space-y-6">

            {/* Custom Stepper */}
            <div className="mb-8">
              <div className="flex items-center justify-between relative px-4 sm:px-12">
                {/* Connecting Line */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full px-12 z-0 hidden sm:block">
                  <div className="w-full h-1 bg-gray-200 rounded-full dark:bg-gray-100">
                    <div
                      className="h-full bg-[#009744] rounded-full transition-all duration-500 ease-in-out"
                      style={{
                        width: step === 'shipping' ? '0%' : step === 'payment' ? '50%' : '100%'
                      }}
                    />
                  </div>
                </div>

                {/* Step 1: Shipping */}
                <div className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group" onClick={() => setStep('shipping')}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${step === 'shipping' || step === 'payment' || step === 'review' ? 'bg-[#009744] border-[#009744] text-white shadow-lg shadow-green-500/30' : 'bg-white border-gray-300 text-gray-400'}`}>
                      {step === 'payment' || step === 'review' ? <Check className="w-6 h-6" /> : <Truck className="w-5 h-5" />}
                   </div>
                   <span className={`text-xs sm:text-sm font-semibold transition-colors duration-300 ${step === 'shipping' ? 'text-[#009744]' : 'text-gray-500'}`}>
                      Shipping
                   </span>
                </div>

                {/* Step 2: Payment */}
                <div className="relative z-10 flex flex-col items-center gap-2 cursor-pointer group" onClick={() => isShippingAddressValid && setStep('payment')}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${step === 'payment' || step === 'review' ? 'bg-[#009744] border-[#009744] text-white shadow-lg shadow-green-500/30' : 'bg-white border-gray-300 text-gray-400'} ${!isShippingAddressValid ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      {step === 'review' ? <Check className="w-6 h-6" /> : <div className="text-sm font-bold">2</div>}
                   </div>
                   <span className={`text-xs sm:text-sm font-semibold transition-colors duration-300 ${step === 'payment' ? 'text-[#009744]' : 'text-gray-500'}`}>
                      Payment
                   </span>
                </div>

                {/* Step 3: Review */}
                <div className="relative z-10 flex flex-col items-center gap-2 cursor-not-allowed opacity-50 data-[active=true]:opacity-100 data-[active=true]:cursor-pointer" data-active={step === 'review'}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${step === 'review' ? 'bg-[#009744] border-[#009744] text-white shadow-lg shadow-green-500/30' : 'bg-white border-gray-300 text-gray-400'}`}>
                      <div className="text-sm font-bold">3</div>
                   </div>
                   <span className={`text-xs sm:text-sm font-semibold transition-colors duration-300 ${step === 'review' ? 'text-[#009744]' : 'text-gray-500'}`}>
                      Review
                   </span>
                </div>
              </div>
            </div>

            {/* Steps Content */}
            <TabsContent value="shipping" className="space-y-6 text-gray-900 mt-0">
              <Card className="bg-white border-none shadow-xl ring-1 ring-black/5 rounded-2xl overflow-hidden">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100 px-6 py-4">
                  <div className="flex items-center gap-3">
                     <div className="bg-green-100 p-2 rounded-lg">
                        <Truck className="w-5 h-5 text-[#009744]" />
                     </div>
                     <CardTitle className="text-lg font-bold text-gray-900">{t('checkout.shippingAddress')}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <Label className="text-gray-700 font-medium text-sm flex items-center gap-1">
                          {t('checkout.firstName')} <span className="text-red-500">*</span>
                       </Label>
                       <Input
                         placeholder="e.g. John"
                         className="h-11 px-4 border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:border-[#009744] focus:ring-4 focus:ring-[#009744]/10 transition-all rounded-xl"
                         value={shippingAddress.firstName || ''}
                         onChange={(e) => setShippingAddress({ ...shippingAddress, firstName: e.target.value })}
                       />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-gray-700 font-medium text-sm flex items-center gap-1">
                          {t('checkout.lastName')} <span className="text-red-500">*</span>
                       </Label>
                       <Input
                         placeholder="e.g. Doe"
                         className="h-11 px-4 border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:border-[#009744] focus:ring-4 focus:ring-[#009744]/10 transition-all rounded-xl"
                         value={shippingAddress.lastName || ''}
                         onChange={(e) => setShippingAddress({ ...shippingAddress, lastName: e.target.value })}
                       />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-700 font-medium text-sm flex items-center gap-1">
                       {t('checkout.email')} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                       placeholder="john@example.com"
                       className="h-11 px-4 border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:border-[#009744] focus:ring-4 focus:ring-[#009744]/10 transition-all rounded-xl"
                       type="email"
                       value={shippingAddress.email || ''}
                       onChange={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-700 font-medium text-sm flex items-center gap-1">
                       {t('checkout.phone')} <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex gap-3">
                      <select
                        value={shippingAddress.countryCode || (countryCodes.find(c => c.code === shippingAddress.country)?.dialCode) || '+91'}
                        onChange={(e) => {
                          const selectedCountry = countryCodes.find(c => c.dialCode === e.target.value);
                          setShippingAddress({
                            ...shippingAddress,
                            countryCode: e.target.value,
                            country: selectedCountry?.code || shippingAddress.country || 'IN',
                          });
                        }}
                        className="w-32 h-11 px-3 border border-gray-200 bg-gray-50/50 rounded-xl focus:border-[#009744] focus:ring-4 focus:ring-[#009744]/10 outline-none text-gray-900 font-medium cursor-pointer"
                      >
                        {countryCodes.map((country) => (
                          <option key={country.code} value={country.dialCode}>
                            {country.dialCode}
                          </option>
                        ))}
                      </select>
                      <Input
                        placeholder="98765 43210"
                        className="flex-1 h-11 px-4 border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:border-[#009744] focus:ring-4 focus:ring-[#009744]/10 transition-all rounded-xl"
                        value={shippingAddress.phone || ''}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-700 font-medium text-sm flex items-center gap-1">
                       Full Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                       placeholder="House No, Street, Area"
                       className="h-11 px-4 border-gray-200 bg-gray-50/50 text-gray-900 focus:bg-white focus:border-[#009744] focus:ring-4 focus:ring-[#009744]/10 transition-all rounded-xl"
                       value={shippingAddress.streetAddress || ''}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          streetAddress: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label className="text-gray-800 font-semibold text-xs xs:text-xs sm:text-sm">Landmark</Label>
                    <Input
                      placeholder="Near landmark (optional)"
                      className="text-xs xs:text-xs sm:text-sm border-gray-300 focus:border-[#009744] focus:ring-[#009744] h-9 xs:h-9 sm:h-10 px-2.5 xs:px-3 sm:px-3"
                      value={shippingAddress.apartment || ''}
                      onChange={(e) =>
                        setShippingAddress({
                          ...shippingAddress,
                          apartment: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
                    <div>
                      <Label className="text-gray-800 font-semibold text-xs xs:text-xs sm:text-sm">{t('checkout.postal')} (PIN Code)</Label>
                      <div className="relative">
                        <Input
                          placeholder="Enter PIN/Zip code"
                          className="text-xs xs:text-xs sm:text-sm border-gray-300 focus:border-[#009744] focus:ring-[#009744] h-9 xs:h-9 sm:h-10 px-2.5 xs:px-3 sm:px-3"
                          value={shippingAddress.postalCode || ''}
                          onChange={(e) =>
                            setShippingAddress({
                              ...shippingAddress,
                              postalCode: e.target.value.replace(/[^a-zA-Z0-9\s-]/g, ''),
                            })
                          }
                        />
                        {fetchingPincode && (
                          <div className="absolute right-2 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-[#009744] border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-800 font-semibold text-xs xs:text-xs sm:text-sm">{t('checkout.city')}</Label>
                      <Input
                        placeholder={fetchingPincode ? 'Loading...' : t('checkout.placeholderCity')}
                        className="text-xs xs:text-xs sm:text-sm border-gray-300 focus:border-[#009744] focus:ring-[#009744] h-9 xs:h-9 sm:h-10 px-2.5 xs:px-3 sm:px-3"
                        value={shippingAddress.city || ''}
                        onChange={(e) =>
                          setShippingAddress({
                            ...shippingAddress,
                            city: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-4">
                    <div>
                      <Label className="text-gray-800 font-semibold text-xs xs:text-xs sm:text-sm">{t('checkout.state')}</Label>
                      <Input
                        placeholder={fetchingPincode ? 'Loading...' : t('checkout.placeholderState')}
                        className="text-xs xs:text-xs sm:text-sm border-gray-300 focus:border-[#009744] focus:ring-[#009744] h-9 xs:h-9 sm:h-10 px-2.5 xs:px-3 sm:px-3"
                        value={shippingAddress.state || ''}
                        onChange={(e) =>
                          setShippingAddress({
                            ...shippingAddress,
                            state: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-gray-800 font-semibold text-xs xs:text-xs sm:text-sm">{t('checkout.country')}</Label>
                      <select
                        value={shippingAddress.country || ''}
                        onChange={(e) => {
                          const selectedCountry = countryCodes.find(c => c.code === e.target.value);
                          setShippingAddress({
                            ...shippingAddress,
                            country: e.target.value,
                            countryCode: selectedCountry?.dialCode || '+91',
                          });
                        }}
                        className="w-full px-2.5 xs:px-3 sm:px-3 py-2 xs:py-2 sm:py-2 border border-gray-300 rounded-md focus:border-[#009744] focus:ring-[#009744] bg-white text-gray-800 font-medium text-xs xs:text-xs sm:text-sm h-9 xs:h-9 sm:h-10"
                      >
                        <option value="" className="bg-white text-gray-800">{t('checkout.selectCountry')}</option>
                        {countryCodes.map((country) => (
                          <option key={country.code} value={country.code} className="bg-white text-gray-800">
                            {country.name} ({country.currency})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Shipping Options */}
              {shippingAddress.country && (
                <Card className="bg-white dark:bg-white border-gray-200">
                  <CardHeader className="bg-white dark:bg-white border-b border-gray-200 p-3 xs:p-4 sm:p-5">
                    <CardTitle className="text-sm xs:text-base sm:text-lg text-gray-800 flex items-center gap-2">
                      <Truck className="h-5 w-5 text-[#009744]" />
                      Shipping Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 bg-white dark:bg-white p-3 xs:p-4 sm:p-5">
                    {/* Shipping Zone Info */}
                    {shippingDetails && (
                      <div className="p-3 bg-[#009744]/5 border border-[#009744]/20 rounded-lg mb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-[#009744]" />
                          <span className="text-sm font-medium text-[#009744]">
                            {shippingDetails.zone.name}
                          </span>
                        </div>
                        <p className="text-xs text-[#009744]/80">
                          {shippingDetails.rateDisplay}
                        </p>
                      </div>
                    )}

                    {/* Shipping Speed Options */}
                    {getAvailableShippingOptions(shippingAddress.country || 'IN').map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-all ${
                          shippingOptionId === option.id
                            ? 'border-[#009744] bg-[#009744]/5'
                            : 'border-gray-200 hover:border-[#009744]/50 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="shippingOption"
                            value={option.id}
                            checked={shippingOptionId === option.id}
                            onChange={(e) => setShippingOptionId(e.target.value)}
                            className="accent-[#009744]"
                          />
                          <div className="flex items-center gap-2">
                            {option.id === 'overnight' ? (
                              <Zap className="h-4 w-4 text-[#AB1F23]" />
                            ) : (
                              <Truck className="h-4 w-4 text-[#009744]" />
                            )}
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">{option.name}</p>
                              <p className="text-xs text-gray-500">{option.description}</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {option.extraCostPerPiece > 0 ? (
                            <p className="text-sm font-semibold text-[#AB1F23]">+₹{option.extraCostPerPiece}/piece</p>
                          ) : (
                            <p className="text-sm font-semibold text-[#009744]">Included</p>
                          )}
                        </div>
                      </label>
                    ))}

                    {/* Free Shipping Progress */}
                    {shippingDetails && !shippingDetails.isFreeShipping && shippingDetails.amountForFreeShipping > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-xs text-gray-800 mb-2">
                          Add <span className="font-bold text-[#AB1F23]">₹{Math.ceil(shippingDetails.amountForFreeShipping)}</span> more to unlock <span className="font-bold text-[#009744]">FREE Shipping!</span>
                        </p>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#009744] transition-all duration-500 ease-out"
                            style={{ width: `${Math.min((subtotal / shippingDetails.freeShippingThreshold) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {shippingDetails?.isFreeShipping && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs text-green-800 flex items-center gap-2">
                          <Check className="h-4 w-4" />
                          <span>🎉 You qualify for <span className="font-bold">FREE shipping!</span></span>
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button
                size="lg"
                className="w-full bg-[#009744] hover:bg-[#2E763B] text-white text-xs xs:text-sm sm:text-base py-5 xs:py-6 sm:py-7"
                onClick={() => setStep('payment')}
                disabled={!isShippingAddressValid}
              >
                {t('checkout.continueToPayment')}
              </Button>
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment" className="space-y-6 text-gray-900">
              <Card className="bg-white dark:bg-white border-gray-200">
                <CardHeader className="bg-white dark:bg-white border-b border-gray-200">
                  <CardTitle className="text-gray-800">{t('checkout.paymentMethod')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 bg-white dark:bg-white">
                  {availablePaymentMethods.map((method) => (
                    <label
                      key={method.id}
                      className="flex items-center p-4 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-[#009744]"
                    >
                      <input
                        type="radio"
                        name="payment"
                        value={method.id}
                        checked={paymentMethodId === method.id}
                        onChange={(e) => setPaymentMethodId(e.target.value)}
                        className="mr-3 accent-[#009744]"
                      />
                      <p className="font-semibold text-gray-800">{method.name}</p>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Promo Code */}
              <Card className="bg-white dark:bg-white border-gray-200">
                <CardHeader className="bg-white dark:bg-white border-b border-gray-200">
                  <CardTitle className="text-gray-800">{t('checkout.promoCode')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 bg-white dark:bg-white">
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check size={20} className="text-green-600" />
                        <p className="font-semibold text-gray-900">{appliedPromo.code}</p>
                      </div>
                      <button
                        onClick={() => setAppliedPromo(null)}
                        className="text-sm text-gray-900 hover:text-gray-700 font-medium"
                      >
                        {t('checkout.remove')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder={t('checkout.enterPromoPlaceholder')}
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          setPromoError('');
                        }}
                        className="border-gray-300 focus:border-[#009744] focus:ring-[#009744]"
                      />
                      <Button
                        variant="outline"
                        onClick={handleApplyPromo}
                        disabled={!promoCode}
                        className="border-[#009744] text-[#009744] hover:bg-[#009744]/10"
                      >
                        {t('checkout.applyCode')}
                      </Button>
                    </div>
                  )}
                  {promoError && (
                    <p className="text-sm text-gray-700 flex items-center gap-2">
                      <AlertCircle size={16} />
                      {promoError}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Gift Message & Subscription */}
              <Card className="bg-white dark:bg-white border-gray-200">
                <CardHeader className="bg-white dark:bg-white border-b border-gray-200">
                  <CardTitle className="text-gray-800">Additional Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 bg-white dark:bg-white">
                  <div>
                    <Label className="text-gray-800 font-semibold">{t('checkout.giftMessage')}</Label>
                    <textarea
                      value={giftMessage}
                      onChange={(e) => setGiftMessage(e.target.value)}
                      placeholder={t('checkout.giftPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-[#009744] focus:ring-[#009744]"
                      rows={3}
                    />
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer p-3 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-[#009744]">
                    <input
                      type="checkbox"
                      checked={subscribe}
                      onChange={(e) => setSubscribe(e.target.checked)}
                      className="accent-[#009744]"
                    />
                    <div>
                      <p className="font-semibold text-gray-800">{t('checkout.subscribe')}</p>
                      <p className="text-sm text-gray-600">{t('checkout.getDiscount')}</p>
                    </div>
                  </label>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full bg-[#009744] hover:bg-[#2E763B] text-white font-bold"
                onClick={() => setStep('review')}
              >
                Review Order
              </Button>
            </TabsContent>

            {/* Review Tab */}
            <TabsContent value="review" className="space-y-6 text-gray-900">
              <Card className="border border-gray-200 bg-white dark:bg-white">
                <CardHeader className="bg-gray-50 dark:bg-gray-50 border-b border-gray-200">
                  <CardTitle className="text-gray-800">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 bg-white dark:bg-white">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Shipping Address</h4>
                    <p className="text-sm text-gray-700">
                      {shippingAddress.firstName} {shippingAddress.lastName}
                      <br />
                      {shippingAddress.streetAddress}, {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                      <br />
                      {shippingAddress.country}
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">{t('checkout.paymentMethod')}</h4>
                    <p className="text-sm text-gray-700">
                      {paymentMethods.find((m) => m.id === paymentMethodId)?.name}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full bg-[#009744] hover:bg-[#2E763B] text-white font-bold text-lg py-6"
                onClick={handlePlaceOrder}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : t('checkout.placeOrder')}
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        {/* Order Summary Sidebar */}
        <div>
          <Card className="sticky top-24 border-0 shadow-xl bg-white/90 backdrop-blur-md overflow-hidden ring-1 ring-black/5 rounded-2xl">
            <CardHeader className="bg-gradient-to-br from-gray-50 to-white border-b border-gray-100 pb-6 pt-6">
              <CardTitle className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                {t('checkout.orderSummary')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Items List */}
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
                {items.map((item) => (
                  <div key={item.id} className="group flex gap-4 py-3 border-b border-dashed border-gray-100 last:border-0">
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      <img
                        src={item.image || "/images/placeholder.png"}
                        alt={item.name}
                        className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-110"
                      />
                      <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-tl-lg bg-black text-[10px] font-bold text-white shadow">
                        {item.quantity}
                      </div>
                    </div>

                    <div className="flex flex-1 flex-col justify-between py-0.5">
                      <div>
                        <h3 className="text-sm font-medium text-gray-900 line-clamp-2 leading-snug">
                          {t(item.name)}
                        </h3>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.packageSize}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="space-y-3 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('checkout.subtotal')}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
                </div>

                {appliedPromo && (
                  <div className="flex justify-between text-sm animate-in fade-in slide-in-from-right-2">
                    <span className="text-green-600 flex items-center gap-1.5 font-medium">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      {t('checkout.discount')} <span className="text-xs ml-1 bg-green-100 px-1.5 py-0.5 rounded text-green-700 uppercase tracking-wide">{appliedPromo.code}</span>
                    </span>
                    <span className="font-medium text-green-600">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('cart.shipping')}</span>
                  <span className="font-medium">
                    {calculatingShipping ? (
                      <span className="flex items-center gap-1 text-amber-600 text-xs">
                         <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
                         Calculating...
                      </span>
                    ) : !shippingDetails ? (
                       <span className="text-gray-400 italic text-xs">Enter details</span>
                    ) : shippingCost === 0 ? (
                      <span className="text-[#009744] font-bold">Free</span>
                    ) : (
                      <span className="text-gray-900">{formatCurrency(shippingCost)}</span>
                    )}
                  </span>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-gray-900">{t('cart.total')}</span>
                    <span className="text-xs text-gray-500 font-normal">Including taxes</span>
                  </div>
                  <span className="text-2xl font-black tracking-tight text-[#009744]">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Trust/Guarantee Micro-copy */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-3 mt-2">
                 <Shield className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                 <p className="text-xs text-gray-500 leading-relaxed">
                   <strong>100% Secure Checkout.</strong> Your personal information is encrypted and protected.
                 </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
