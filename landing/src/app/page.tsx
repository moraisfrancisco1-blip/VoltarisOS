import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { BentoFeatures } from "@/components/bento-features";
import { Architecture } from "@/components/architecture";
import { SocialProof } from "@/components/social-proof";
import { LeadCapture } from "@/components/lead-capture";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <Hero />
      <BentoFeatures />
      <Architecture />
      <SocialProof />
      <LeadCapture />
      <Footer />
    </main>
  );
}