'use client';

import { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import ProductCard from '@/components/product/ProductCard';
import { products as initialProducts } from '@/data/products';
import { Product } from '@/types';

export default function NewArrivals() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
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
  }, []);

  const allProducts = items.length > 0 ? items : initialProducts;
  const newArrivals = allProducts.filter(p => p.isNewArrival || p.badge === 'NEW_ARRIVAL');

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [newArrivals.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-end mb-12">
          <div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-5xl font-serif text-gray-900 mb-4"
            >
              New Arrivals
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-gray-500"
            >
              The latest additions to our collection
            </motion.p>
          </div>

          <div className="hidden md:flex gap-3">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Scroll left"
              className={`p-3 rounded-full border transition-all ${
                canScrollLeft 
                  ? 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white' 
                  : 'border-gray-200 text-gray-300 cursor-not-allowed'
              }`}
            >
              <HiChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Scroll right"
              className={`p-3 rounded-full border transition-all ${
                canScrollRight 
                  ? 'border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white' 
                  : 'border-gray-200 text-gray-300 cursor-not-allowed'
              }`}
            >
              <HiChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel Container */}
        <div 
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-8 pt-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {newArrivals.map((product) => (
            <div 
              key={product.id} 
              className="w-[280px] sm:w-[320px] flex-shrink-0 snap-start"
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
