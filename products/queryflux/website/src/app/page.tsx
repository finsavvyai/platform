import { Features } from "@/components/sections/Features";
import { Hero, Testimonials, CTA } from "@/components/DynamicComponents";
// import { InteractiveDemo } from "@/components/sections/InteractiveDemo";
// import { DynamicPricing } from "@/components/sections/DynamicPricing";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Hero />
      {/* <InteractiveDemo /> */}
      <Features />
      {/* <DynamicPricing /> */}
      <Testimonials />
      <CTA />
    </main>
  );
}
