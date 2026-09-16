'use client';

import ProductCard from '@/components/product/ProductCard';
import { products } from '@/data/products';
import Link from 'next/link';

export default function SpecialOffersPage() {
  const offers = products.filter((product) =>
    ['SPECIAL_OFFER', 'LIMITED_TIME', 'PREMIUM_COLLECTION'].includes(
      String(product.badge || '').toUpperCase()
    ) || (
      typeof product.salePrice === 'number' &&
      product.salePrice < product.originalPrice
    )
  );

  return (
    <main className="min-h-screen bg-ivory pt-28 pb-20">
      <div className="container mx-auto px-4">

        <nav className="text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-gold transition">
            Home
          </Link>
          <span className="mx-2">&gt;</span>
          <span className="text-black font-medium">Special Offers</span>
        </nav>

        <div className="text-center max-w-2xl mx-auto mb-16">
          <h1 className="text-4xl md:text-5xl font-serif text-gray-900 mb-4">
            Special Offers
          </h1>
          <p className="text-gray-600 text-lg">
            Discover selected ILMA pieces available at special prices.
          </p>
        </div>

        {offers.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            New offers are coming soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {offers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
