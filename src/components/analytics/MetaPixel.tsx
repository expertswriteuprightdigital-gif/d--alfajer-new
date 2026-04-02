"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

const PIXEL_IDS = ["1192303348657440", "1306274733589363"];

interface WindowWithFBQ extends Window {
  fbq?: (...args: unknown[]) => void;
}

export const MetaPixel = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Function to fire tracking
    const fireTracking = () => {
      const fbq = (window as WindowWithFBQ).fbq;
      if (typeof fbq === "function") {
        fbq("track", "PageView");
      }
    };

    if (isFirstRender.current) {
      // First page render. The inline script already fired the initial PageView and initialized fbq.
      isFirstRender.current = false;
      // Track unique visitor on first client-side load
      fetch('/api/track-visit', { method: 'POST' }).catch(console.error);
    } else {
      // For subsequent route changes, check consent and fire tracking
      const hasConsentRecord = document.cookie.split('; ').find(row => row.startsWith('cookie_consent='));
      if (hasConsentRecord && hasConsentRecord.split('=')[1] === 'accepted') {
         fireTracking();
      }
    }

    // Listen for consent updates from banner
    const handleConsentUpdate = (event: Event) => {
       const customEvent = event as CustomEvent;
       if (customEvent.detail === 'accepted') {
           // We might need to handle the case where consent is accepted on the first page load.
           // However, if the inline script fired 'PageView' unconditionally, we might send it again.
           // Usually, cookie consent script handles removing inline firing if not accepted initially.
           // For now, we will fire it, but the inline script might have already fired it.
           fireTracking();
       }
    };
    window.addEventListener('cookieConsentUpdated', handleConsentUpdate);

    return () => window.removeEventListener('cookieConsentUpdated', handleConsentUpdate);
  }, [pathname, searchParams]);

  return (
    <>
      <Script
        id="fb-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            ${PIXEL_IDS.map((id) => `fbq('init', '${id}');`).join("\n")}
            fbq('track', 'PageView');
          `,
        }}
      />
      <div>
        {PIXEL_IDS.map((id) => (
          <noscript key={id}>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        ))}
      </div>
    </>
  );
};
