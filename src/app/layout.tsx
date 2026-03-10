import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/src/components/providers";
import { AnnouncementBar } from "@/src/components/announcement-bar/AnnouncementBar";
import { Header } from "@/src/components/header/Header";
import { DynamicFavicon } from "@/src/components/header/DynamicFavicon";
import { AdminFooterWrapper } from "@/src/components/admin/admin-footer-wrapper";
import { MetaPixel } from "@/src/components/analytics/MetaPixel";
import { CookieBanner } from "@/src/components/analytics/CookieBanner";
import { Suspense } from "react";
import Script from "next/script";

const GA_MEASUREMENT_ID = "G- 506-982-6248"; // TODO: Replace with your actual GA Measurement ID
const GOOGLE_ADS_ID = "AW-17980198435";

export const metadata: Metadata = {
  title: "Premium Dry Fruits & Spices",
  description: "100% authentic premium dry fruits and spices delivered worldwide",
  icons: {
    icon: "/images/alfajerlogo.jpeg",
  },
  verification: {
    google: "exWRc2yw-k25UaIFDpmETuVqjb-hR_X7LqV9XOPY_9o",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/images/alfajerlogo.jpeg" />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
      </head>
      <body className="antialiased overflow-x-clip w-full" suppressHydrationWarning>
        <Suspense fallback={null}>
          <MetaPixel />
        </Suspense>
        <CookieBanner />
        <Providers attribute="class" defaultTheme="system" enableSystem>
          <DynamicFavicon />
          <AnnouncementBar />
          <Header />
          <AdminFooterWrapper>
            <main className="mt-0 pt-0 w-full overflow-x-clip">
              {children}
            </main>
          </AdminFooterWrapper>
        </Providers>
      </body>
    </html>
  );
}
