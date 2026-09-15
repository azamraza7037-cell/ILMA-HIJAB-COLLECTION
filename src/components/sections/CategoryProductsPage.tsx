'use client';

import { useState, useEffect } from 'react';
import ProductCard from '@/components/product/ProductCard';
import { products as initialProducts } from '@/data/products';
import { Product } from '@/types';
import Link from 'next/link';

interface CategoryPageProps {
  category: 'ABAYA' | 'HIJAB' | 'NAQAB';
  title: string;
  description: string;
}

export default function CategoryProductsPage({ category, title, description }: CategoryPageProps) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategory = async () => {
      try {
        const res = await fetch(`/api/products?category=${category}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setItems(data);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn('API error, falling back', e);
      }
      setItems(initialProducts.filter(p => p.category === category));
      setLoading(false);
    };

    fetchCategory();
  }, [category]);

  return (
    <div className="min-h-screen bg-ivory pt-28 pb-20">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-gold transition">Home</Link>
          <span className="mx-2">&gt;</span>
          <span className="text-black font-medium">{title}</span>
        </nav>

        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-gray-900 mb-4">{title}</h1>
          <p className="text-gray-600 text-lg leading-relaxed">{description}</p>
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="h-px w-16 bg-[#C9A96E]"></div>
            <div className="w-2.5 h-2.5 rotate-45 border border-[#C9A96E]"></div>
            <div className="h-px w-16 bg-[#C9A96E]"></div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading exquisite collection...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-500">No products available in this category yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
