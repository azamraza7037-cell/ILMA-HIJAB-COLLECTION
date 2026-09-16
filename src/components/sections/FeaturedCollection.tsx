'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductCard from '@/components/product/ProductCard';
import { products as initialProducts } from '@/data/products';
import Link from 'next/link';
import { Product } from '@/types';

type FilterCategory = 'ALL' | 'ABAYA' | 'HIJAB' | 'NAQAB';

const categories: { label: string; value: FilterCategory }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Abayas', value: 'ABAYA' },
  { label: 'Hijabs', value: 'HIJAB' },
  { label: 'Naqabs', value: 'NAQAB' }
];

export default function FeaturedCollection() {
  const [activeTab, setActiveTab] = useState<FilterCategory>('ALL');
  const allProducts = initialProducts;
  const filteredProducts = activeTab === 'ALL' 
    ? allProducts.slice(0, 8) 
    : allProducts.filter(p => p.category === activeTab).slice(0, 8);

  return (
    <section className="py-24 bg-[#0a0a0a] text-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-serif mb-4"
          >
            Our Collection
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#C9A96E] text-lg font-light"
          >
            Curated pieces of elegance and modesty
          </motion.p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveTab(cat.value)}
              className={`relative px-6 py-2 rounded-full text-sm font-medium tracking-wider transition-colors duration-300 ${
                activeTab === cat.value ? 'text-black' : 'text-gray-400 hover:text-white border border-gray-800'
              }`}
            >
              {activeTab === cat.value && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-[#C9A96E] rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <span className="relative z-10">{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <motion.div layout className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
            >
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-16 text-gray-400">
                  <p className="mb-4 text-sm">Products are temporarily unavailable.</p>                   <button
                     onClick={() => window.location.reload()}
                     className="px-6 py-2 border border-[#C9A96E] text-[#C9A96E] text-xs font-semibold uppercase tracking-wider rounded hover:bg-[#C9A96E] hover:text-black transition"
                   >
                     Retry
                   </button>
                </div>
              ) : (
                filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <div className="text-center mt-16">
          <Link 
            href={activeTab === 'ABAYA' ? '/abayas' : activeTab === 'HIJAB' ? '/hijabs' : activeTab === 'NAQAB' ? '/naqabs' : '/#collection'} 
            className="inline-block"
          >
            <button className="px-8 py-3 bg-transparent border border-white/20 text-white font-medium tracking-widest text-sm hover:bg-white hover:text-black transition-colors duration-300">
              VIEW ALL PRODUCTS
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}


