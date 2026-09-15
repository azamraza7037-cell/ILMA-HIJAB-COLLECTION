import { Product, BADGE_LABELS, BADGE_COLORS } from '@/types';
import { formatPrice, calculateDiscount } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, Star, StarHalf } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [imageError, setImageError] = useState(false);
  const addItem = useCartStore((state) => state.addItem);

  if (!product) return null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem(product, 1);
  };

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsWishlisted(!isWishlisted);
  };

  // Determine gradient based on category
  const getGradient = (category?: string) => {
    switch (category?.toUpperCase()) {
      case 'ABAYA':
        return 'linear-gradient(to bottom, #1a1a2e, #16213e)';
      case 'HIJAB':
        return 'linear-gradient(to bottom, #2d132c, #801336)';
      case 'NAQAB':
        return 'linear-gradient(to bottom, #0a0a0a, #1a1a2e)';
      default:
        return 'linear-gradient(to bottom, #1a1a2e, #16213e)';
    }
  };

  const originalPrice = typeof product.originalPrice === 'number' ? product.originalPrice : (product.price || 0);
  const salePrice = typeof product.salePrice === 'number' ? product.salePrice : null;
  const hasSale = salePrice !== null && salePrice < originalPrice;
  const currentPrice = hasSale ? salePrice : originalPrice;
  const discountPercent = calculateDiscount(originalPrice, salePrice);
  const isOutOfStock = typeof product.stock === 'number' ? product.stock <= 0 : false;

  // Rating stars
  const renderStars = () => {
    const stars = [];
    const ratingValue = typeof product.rating === 'number' && !isNaN(product.rating) ? product.rating : 5;
    const fullStars = Math.floor(ratingValue);
    const hasHalfStar = ratingValue % 1 !== 0;

    for (let i = 0; i < fullStars; i++) {
      stars.push(<Star key={`full-${i}`} className="w-4 h-4 fill-amber-400 text-amber-400" />);
    }
    if (hasHalfStar) {
      stars.push(<StarHalf key="half" className="w-4 h-4 fill-amber-400 text-amber-400" />);
    }
    const emptyStars = Math.max(0, 5 - stars.length);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<Star key={`empty-${i}`} className="w-4 h-4 text-gray-300" />);
    }
    return stars;
  };

  const firstImage = Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;

  return (
    <Link href={`/product/${product.slug || product.id}`} className="block group">
      <motion.div 
        whileHover={{ y: -5 }}
        className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 h-full flex flex-col"
      >
        {/* Image Area */}
        <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
          {firstImage && !imageError && (firstImage.startsWith('/') || firstImage.startsWith('http')) ? (
            <div className="w-full h-full relative">
              <Image 
                src={firstImage} 
                alt={product.name || 'Product'} 
                fill 
                onError={() => setImageError(true)}
                className="object-cover transition-transform duration-500 group-hover:scale-105" 
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
              />
            </div>
          ) : (
            <motion.div 
              className="w-full h-full flex items-center justify-center transition-transform duration-500 group-hover:scale-105"
              style={{ background: getGradient(product.category) }}
            >
              {/* Elegant silhouette placeholder */}
              <div className="w-24 h-32 border border-white/20 rounded-t-full flex items-center justify-center opacity-70">
                <span className="text-white/50 text-xs tracking-widest">{product.category || 'ILMA'}</span>
              </div>
            </motion.div>
          )}

          {/* Badge */}
          {product.badge && product.badge !== 'NONE' && (
            <div className="absolute top-3 left-3 z-10">
              <span 
                className="text-[10px] font-bold px-2.5 py-1 rounded-sm tracking-wider uppercase text-white shadow-sm"
                style={{ backgroundColor: BADGE_COLORS[product.badge] || '#000' }}
              >
                {BADGE_LABELS[product.badge] || product.badge.replace('_', ' ')}
              </span>
            </div>
          )}

          {/* Out of Stock overlay */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
              <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded tracking-widest uppercase shadow">
                Out of Stock
              </span>
            </div>
          )}

          {/* Wishlist Button */}
          <button 
            onClick={handleWishlistToggle}
            className="absolute top-3 right-3 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm"
            aria-label="Toggle wishlist"
          >
            <motion.div whileTap={{ scale: 0.8 }}>
              <Heart 
                className={`w-5 h-5 transition-colors ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
              />
            </motion.div>
          </button>

          {/* Quick View (Desktop Hover) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-gradient-to-t from-black/60 to-transparent flex justify-center">
            <span className="text-white text-sm font-medium tracking-wider border-b border-white/50 pb-0.5">Quick View</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-5 flex flex-col flex-grow">
          <h3 className="font-semibold text-gray-900 text-base line-clamp-1 mb-1 font-serif">
            {product.name}
          </h3>
          <p className="text-sm text-gray-500 line-clamp-1 mb-3">
            {product.shortDescription || product.description}
          </p>

          <div className="flex items-center gap-1 mb-3">
            {renderStars()}
            <span className="text-xs text-gray-500 ml-1">({product.reviewCount || 0})</span>
          </div>

          <div className="mt-auto pt-3 flex flex-col gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-gray-900">
                {formatPrice(currentPrice)}
              </span>
              {hasSale && (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                    -{discountPercent}%
                  </span>
                </>
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className={`w-full py-2.5 rounded text-sm font-medium tracking-wider transition-colors ${
                isOutOfStock 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-black text-white hover:bg-[#C9A96E] hover:text-black'
              }`}
            >
              {isOutOfStock ? 'OUT OF STOCK' : 'ADD TO CART'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
