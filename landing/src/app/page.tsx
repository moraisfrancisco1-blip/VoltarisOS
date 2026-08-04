import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { VideoShowcase } from "@/components/video-showcase";
import { BentoFeatures } from "@/components/bento-features";
import { ScreenshotsGallery } from "@/components/screenshots-gallery";
import { SocialProof } from "@/components/social-proof";
import { Pricing } from "@/components/pricing";
import { FAQ } from "@/components/faq";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <Hero />
      <VideoShowcase />
      <BentoFeatures />
      <ScreenshotsGallery />
      <SocialProof />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}