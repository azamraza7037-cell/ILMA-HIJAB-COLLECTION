'use client';

import { motion } from 'framer-motion';

export default function BrandStory() {
  return (
    <section className="relative py-32 bg-white overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-[0.03]">
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full border border-black"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-64 h-64 rounded-full border border-black"></div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[#C9A96E] text-xs font-bold tracking-[0.3em] uppercase mb-6 block">
            Our Story
          </span>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif text-gray-900 mb-12 leading-tight">
            Elegance rooted in modesty.
          </h2>

          <div className="flex items-center justify-center gap-4 mb-12">
            <div className="h-px w-16 bg-[#C9A96E]/50"></div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#C9A96E]">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
            </svg>
            <div className="h-px w-16 bg-[#C9A96E]/50"></div>
          </div>

          <div className="space-y-6 text-gray-600 text-lg md:text-xl font-light leading-relaxed max-w-3xl mx-auto">
            <p>
              At Ilma Hijab Collection, we believe that modesty and elegance are not opposites — they are one and the same. Every abaya, hijab, and naqab in our collection is designed to empower the modern Muslim woman with confidence and grace.
            </p>
            <p>
              Our journey began with a simple vision: to create modest fashion that doesn't compromise on style. From premium fabrics to thoughtful designs, each piece tells a story of craftsmanship, faith, and timeless beauty.
            </p>
            <p className="font-medium text-gray-800">
              We are more than a brand — we are a community of women who celebrate modesty as a statement of strength and sophistication.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
