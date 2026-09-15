import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price in INR (₹)
 */
export function formatPrice(amount: number | null | undefined): string {
  const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(validAmount);
}

/**
 * Calculate discount percentage between original and sale price
 */
export function calculateDiscount(originalPrice?: number | null, salePrice?: number | null): number {
  if (!originalPrice || typeof originalPrice !== 'number' || originalPrice <= 0) return 0;
  if (!salePrice || typeof salePrice !== 'number' || salePrice >= originalPrice) return 0;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}

/**
 * Generate a unique order ID (e.g., IHC-XXXXXX)
 */
export function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'IHC-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Truncate a string to a specific length and add ellipsis
 */
export function truncate(str: string, length: number): string {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}
