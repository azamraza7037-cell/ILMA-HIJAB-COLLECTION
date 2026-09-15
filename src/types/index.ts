export enum Badge {
  SPECIAL_OFFER = 'SPECIAL_OFFER',
  LIMITED_TIME = 'LIMITED_TIME',
  BEST_SELLER = 'BEST_SELLER',
  NEW_ARRIVAL = 'NEW_ARRIVAL',
  PREMIUM_COLLECTION = 'PREMIUM_COLLECTION',
  NONE = 'NONE'
}

export enum Category {
  ABAYA = 'ABAYA',
  HIJAB = 'HIJAB',
  NAQAB = 'NAQAB',
  ACCESSORY = 'ACCESSORY'
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  COD = 'COD'
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string | null;
  category: Category | string;
  images: string[];
  colors: string[];
  sizes: string[];
  originalPrice: number;
  price?: number;
  salePrice?: number | null;
  badge?: Badge | string | null;
  rating: number;
  reviewCount: number;
  stock: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  fabricInfo?: string | null;
  careInstructions?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  color?: string;
  size?: string;
}

export interface Customer {
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderItemData {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
}

export interface Order {
  id: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerWhatsapp?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  items: OrderItemData[];
  subtotal: number;
  shippingFee: number;
  tax: number;
  totalAmount: number;
  status: OrderStatus | string;
  paymentStatus: PaymentStatus | string;
  paymentMethod?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export const BADGE_LABELS: Record<string, string> = {
  SPECIAL_OFFER: 'Special Offer',
  LIMITED_TIME: 'Limited Time Offer',
  BEST_SELLER: 'Best Seller',
  NEW_ARRIVAL: 'New Arrival',
  PREMIUM_COLLECTION: 'Premium Collection',
  NONE: '',
};

export const BADGE_COLORS: Record<string, string> = {
  SPECIAL_OFFER: 'bg-red-600',
  LIMITED_TIME: 'bg-amber-600',
  BEST_SELLER: 'bg-emerald-700',
  NEW_ARRIVAL: 'bg-gold',
  PREMIUM_COLLECTION: 'bg-black',
  NONE: '',
};

export function parseProductJsonFields(product: any): Product {
  return {
    ...product,
    images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
    colors: typeof product.colors === 'string' ? JSON.parse(product.colors) : product.colors,
    sizes: typeof product.sizes === 'string' ? JSON.parse(product.sizes) : product.sizes,
  };
}
