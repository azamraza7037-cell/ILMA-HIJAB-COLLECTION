import HeroSection from "@/components/hero/HeroSection";
import FeaturedCollection from "@/components/sections/FeaturedCollection";
import NewArrivals from "@/components/sections/NewArrivals";
import SpecialOffers from "@/components/sections/SpecialOffers";
import TrustSection from "@/components/sections/TrustSection";
import BrandStory from "@/components/sections/BrandStory";
import WhatsAppButton from '@/components/ui/WhatsAppButton';
import AIStylist from '@/components/ui/AIStylist';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <HeroSection />

      <div id="collection">
        <FeaturedCollection />
      </div>

      <NewArrivals />
      <SpecialOffers />
      <TrustSection />
      <BrandStory />

      <WhatsAppButton />
        <AIStylist />
    </main>
  );
}

