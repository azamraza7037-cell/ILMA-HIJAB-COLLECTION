'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';
import { products as initialProducts } from '@/data/products';
import { Product } from '@/types';

export default function SpecialOffers() {
  const [items, setItems] = useState<Product[]>([]);
  const [timeLeft, setTimeLeft] = useState({
    days: 3,
    hours: 12,
    minutes: 45,
    seconds: 0
  });

  useEffect(() => {
    // Fetch live products from database
    const loadProducts = async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setItems(data);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not fetch products from API, falling back to local data', err);
      }
      setItems(initialProducts);
    };

    loadProducts();

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const offerProducts = (items.length > 0 ? items : initialProducts).filter(
    p => p.badge === 'SPECIAL_OFFER' || p.badge === 'LIMITED_TIME'
  ).slice(0, 3);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
  };

  return (
    <section className="py-24 bg-[#FAF7F2] overflow-hidden">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-serif text-gray-900 mb-4">
              Special Offers
            </h2>
            <p className="text-gray-600 text-lg mb-8">
              Elegant style, special prices.
            </p>
            
            {/* Islamic Geometric Accent Divider */}
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="h-px w-24 bg-[#C9A96E]"></div>
              <div className="w-3 h-3 rotate-45 border border-[#C9A96E]"></div>
              <div className="h-px w-24 bg-[#C9A96E]"></div>
            </div>
          </motion.div>

          {/* Countdown Timer */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex flex-col items-center"
          >
            <span className="text-sm font-bold tracking-[0.2em] text-[#C9A96E] mb-6 uppercase">
              Limited Time Offer
            </span>
            <div className="flex gap-4 md:gap-6">
              {[
                { label: 'Days', value: timeLeft.days },
                { label: 'Hours', value: timeLeft.hours },
                { label: 'Mins', value: timeLeft.minutes },
                { label: 'Secs', value: timeLeft.seconds }
              ].map((unit) => (
                <div key={unit.label} className="flex flex-col items-center">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-black text-white rounded-lg flex items-center justify-center shadow-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                    <span suppressHydrationWarning className="text-2xl md:text-3xl font-serif">
                      {String(unit.value ?? 0).padStart(2, '0')}
                    </span>
                  </div>
                  <span className="text-xs tracking-wider text-gray-500 mt-3 uppercase">{unit.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Products */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-16"
        >
          {offerProducts.map(product => (
            <motion.div key={product.id} variants={itemVariants}>
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Link href="/special-offers" className="inline-block">
            <button className="px-8 py-3 border-2 border-[#C9A96E] text-[#C9A96E] font-medium tracking-widest text-sm hover:bg-[#C9A96E] hover:text-white transition-colors duration-300">
              VIEW ALL OFFERS
            </button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
