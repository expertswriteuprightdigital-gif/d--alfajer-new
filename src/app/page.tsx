import { Suspense } from "react";
import type { Metadata } from "next";
import { HeroSection } from "@/src/components/hero/HeroSection";

export const metadata: Metadata = {
  verification: {
    google: "8JASPAEB98cWUn0NJri6cLBpP2mFPSODIT1rfCL5K1o",
  },
};
import { ExquisiteCollection } from "@/src/components/exquisite-collection";
import { ProductListing } from "@/src/components/products";
import { WhyChooseUs } from "@/src/components/why-choose-us/WhyChooseUs";
import { Newsletter } from "@/src/components/newsletter/Newsletter";

export default function Home() {
  return (
    <div className="w-full overflow-x-clip">
      <HeroSection />
      <ExquisiteCollection />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading products...</div>}>
        <ProductListing />
      </Suspense>
      <WhyChooseUs />
      <Newsletter />
    </div>
  );
}
