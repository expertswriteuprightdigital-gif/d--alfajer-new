"use client";

// Meta Pixel Utility
// ID: 1192303348657440

interface WindowWithFBQ extends Window {
  fbq?: (...args: unknown[]) => void;
}

export const trackViewContent = (product: { id: string; price: number; name: string }) => {
  const fbq = (window as WindowWithFBQ).fbq;
  if (typeof fbq === "function") {
    fbq("track", "ViewContent", {
      content_ids: [product.id],
      content_type: "product",
      content_name: product.name,
      value: product.price,
      currency: "INR",
    });
    console.log(`[Pixel] ViewContent: ${product.name} (${product.id}) - ₹${product.price}`);
  }
};

export const trackAddToCart = (product: { id: string; price: number; name: string; quantity: number }) => {
  const fbq = (window as WindowWithFBQ).fbq;
  if (typeof fbq === "function") {
    fbq("track", "AddToCart", {
      content_ids: [product.id],
      content_type: "product",
      content_name: product.name,
      value: product.price * product.quantity,
      currency: "INR",
    });
    console.log(`[Pixel] AddToCart: ${product.name} (${product.id}) x${product.quantity} - ₹${product.price * product.quantity}`);
  }
};

export const trackInitiateCheckout = (items: { productId?: string; price: number; quantity: number }[], totalValue: number) => {
  const fbq = (window as WindowWithFBQ).fbq;
  if (typeof fbq === "function") {
    fbq("track", "InitiateCheckout", {
      content_ids: items.map(item => item.productId).filter(Boolean),
      content_type: "product",
      value: totalValue,
      currency: "INR",
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    });
    console.log(`[Pixel] InitiateCheckout: ${items.length} items - ₹${totalValue}`);
  }
};

export const trackPurchase = (items: { productId?: string; price: number; quantity: number }[], totalValue: number, orderId: string) => {
  const fbq = (window as WindowWithFBQ).fbq;
  if (typeof fbq === "function") {
    fbq("track", "Purchase", {
      content_ids: items.map(item => item.productId).filter(Boolean),
      content_type: "product",
      value: totalValue,
      currency: "INR",
      order_id: orderId,
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    });
    console.log(`[Pixel] Purchase: Order #${orderId} - ₹${totalValue}`);
  }
};

