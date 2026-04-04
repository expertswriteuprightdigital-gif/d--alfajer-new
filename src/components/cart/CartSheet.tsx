"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Minus, Plus, X, Trash2, ArrowRight, ShoppingCart } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/src/components/ui/sheet";
import { useCartStore, CartItem } from "@/src/lib/cart-store";
import { useI18n } from "@/src/components/providers/i18n-provider";
import { trackInitiateCheckout } from "@/src/utils/pixel";
import { cn } from "@/src/lib/utils";

export function CartSheet() {
  const router = useRouter();
  const { items, isOpen, closeCart, removeItem, updateQuantity, clearCart, getTotalPrice, getTotalItems } = useCartStore();
  const { t, formatCurrency, convertCurrency, currency } = useI18n();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const totalPrice = getTotalPrice();
  const totalItems = getTotalItems();
  const shipping = totalPrice > 200 ? 0 : 25;
  const finalTotal = totalPrice + shipping;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col bg-white z-[9999] max-h-screen overflow-y-auto">
        <SheetHeader className="px-3 sm:px-6 py-4 sm:py-5 border-b border-gray-100 bg-gradient-to-r from-[#009744]/5 to-transparent flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="h-8 sm:h-10 w-8 sm:w-10 rounded-full bg-[#009744] flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="h-4 sm:h-5 w-4 sm:w-5 text-white" />
              </div>
              <div className="min-w-0">
                <SheetTitle className="text-base sm:text-xl font-bold text-gray-900 font-heading truncate">{t('nav.cart')}</SheetTitle>
                <p className="text-xs sm:text-sm text-gray-500 font-body">
                  {totalItems} {totalItems === 1 ? t('cart.item_one') : t('cart.item_other')}
                </p>
              </div>
            </div>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearCart}
                className="text-gray-400 hover:text-[#AB1F23] hover:bg-red-50 transition-colors font-medium text-sm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {t('common.delete')}
              </Button>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6"
            >
              <ShoppingCart className="h-12 w-12 text-gray-300" />
            </motion.div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2 font-heading">{t('cart.empty')}</h3>
            <p className="text-gray-500 mb-8 max-w-xs font-body">
              {t('cart.empty_desc')}
            </p>
            <Button
              onClick={closeCart}
              className="bg-[#009744] hover:bg-[#2E763B] text-white font-semibold px-8 py-3 rounded-full"
            >
              {t('cart.emptyShopping')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-6 py-4">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    onRemove={removeItem}
                    onUpdateQuantity={updateQuantity}
                  />
                ))}
              </AnimatePresence>
            </ScrollArea>

            <SheetFooter className="flex-col gap-0 p-0 border-t border-gray-100">
              <div className="px-6 py-5 space-y-4 bg-gray-50/50">
                <div className="flex justify-between text-sm text-gray-600 font-body">
                  <span>{t('cart.subtotal')}</span>
                  <span className="font-medium text-gray-900">{formatCurrency(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600 font-body">
                  <span>{t('cart.shipping')}</span>
                  <span className="text-gray-500 italic">
                    Calculated at checkout
                  </span>
                </div>

                <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t border-gray-200 font-heading">
                  <span>{t('cart.total')}</span>
                  <span>{formatCurrency(totalPrice)}</span>
                </div>
              </div>

              <div className="px-6 py-5 space-y-3">
                <Button
                  onClick={() => {
                    // Track InitiateCheckout
                    trackInitiateCheckout(
                      items.map(item => ({
                        productId: item.productId,
                        price: item.price,
                        quantity: item.quantity || 1
                      })),
                      totalPrice
                    );
                    closeCart();
                    router.push("/checkout");
                  }}
                  className="w-full bg-[#009744] hover:bg-[#2E763B] text-white font-bold h-14 rounded-full shadow-lg hover:shadow-xl transition-all"
                >
                  <span className="flex items-center gap-2">
                    {t('cart.checkout')}
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </Button>
                <Button
                  variant="outline"
                  onClick={closeCart}
                  className="w-full border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold h-12 rounded-full"
                >
                  {t('cart.emptyShopping')}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function CartItemCard({
  item,
  onRemove,
  onUpdateQuantity,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}) {
  const { formatCurrency, convertCurrency, t } = useI18n();
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="flex gap-4 py-4 border-b border-gray-100 last:border-0"
    >
      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-snug font-body">
              {t(item.name) || item.name}
            </h4>
            <p className="text-xs text-gray-500 mt-1 font-body">{item.packageSize}</p>
          </div>
          <button
            onClick={() => onRemove(item.id)}
            className="p-1.5 hover:bg-red-50 rounded-full transition-colors group"
            aria-label="Remove item"
          >
            <X className="h-4 w-4 text-gray-400 group-hover:text-[#AB1F23]" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900">
              {item.quantity}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              className="h-8 w-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="text-right">
            <p className="font-bold text-gray-900 font-heading">
              {formatCurrency(item.price * item.quantity)}
            </p>
            {item.quantity > 1 && (
              <p className="text-xs text-gray-500 font-body">
                {formatCurrency(item.price)} {t('cart.each')}
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
