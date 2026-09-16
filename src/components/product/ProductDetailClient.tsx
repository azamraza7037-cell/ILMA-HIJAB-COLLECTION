'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';
import { Star, ShieldCheck, Truck, Clock, Minus, Plus, X, Loader2, CreditCard, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/components/product/ProductCard';

import { trackClientEvent } from '@/components/analytics/TrackerProvider';

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir',
  'Ladakh','Puducherry','Chandigarh','Andaman & Nicobar','Lakshadweep',
];

const BUSINESS_WHATSAPP = '7252096645';
const UPI_ID = '7252096645@upi';

interface DeliveryForm {
  fullName: string;
  phone: string;
  email: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  pincode: string;
}

export default function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || 'Black');
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || 'Free Size');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiStep, setUpiStep] = useState<'form' | 'pay'>('form');
  const [upiOrderId, setUpiOrderId] = useState<string | null>(null);
  const [upiTotal, setUpiTotal] = useState<number>(0);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState<DeliveryForm>({
    fullName: '', phone: '', email: '', address1: '', address2: '', city: '', state: '', pincode: '',
  });

  const { addItem, openCart } = useCartStore();
  const router = useRouter();

  useEffect(() => {
    if (product?.id) {
      trackClientEvent('PRODUCT_VIEW', {
        productId: product.id,
        metadata: {
          name: product.name,
          category: product.category,
          price: product.salePrice || product.originalPrice,
        },
      });
    }
  }, [product?.id, product?.name, product?.category, product?.salePrice, product?.originalPrice]);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-serif mb-4">Product Not Found</h1>
        <Link href="/" className="text-[#C9A96E] hover:underline">Return to Collection</Link>
      </div>
    );
  }

  const images = Array.isArray(product.images) && product.images.length > 0 
    ? product.images 
    : [];

  const isOutOfStock = typeof product.stock === 'number' ? product.stock <= 0 : false;
  const unitPrice = product.salePrice ?? product.originalPrice ?? 0;
  const subtotalCalc = unitPrice * quantity;
  const shippingCalc = subtotalCalc > 999 ? 0 : 99;
  const totalCalc = subtotalCalc + shippingCalc;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addItem(product, quantity, selectedColor, selectedSize);
    trackClientEvent('ADD_TO_CART', {
      productId: product.id,
      metadata: {
        name: product.name,
        quantity,
        color: selectedColor,
        size: selectedSize,
        price: unitPrice,
      },
    });
    openCart();
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addItem(product, quantity, selectedColor, selectedSize);
    window.location.href = `upi://pay?pa=ilmaansari87945@oksbi&pn=Payment&am=${totalCalc}&cu=INR`;
  };

  const handleOpenUpiModal = () => {
    if (isOutOfStock) return;
    setUpiStep('form');
    setUpiOrderId(null);
    setShowUpiModal(true);
  };

  const handleDeliveryFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDeliveryForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePlaceUpiOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlacingOrder(true);
    try {
      const payload = {
        items: [{ productId: product.id, quantity, color: selectedColor, size: selectedSize }],
        customerInfo: {
          name: deliveryForm.fullName,
          phone: deliveryForm.phone,
          whatsapp: deliveryForm.phone,
          email: deliveryForm.email,
          addressLine1: deliveryForm.address1,
          addressLine2: deliveryForm.address2,
          city: deliveryForm.city,
          state: deliveryForm.state,
          postalCode: deliveryForm.pincode,
        },
        paymentMethod: 'UPI',
      };
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create order');
      const orderId = data.order?.orderId;
      const serverTotal = data.order?.totalAmount ?? totalCalc;
      setUpiOrderId(orderId);
      setUpiTotal(serverTotal);
      // Remember the customer's phone so the order-status page can verify ownership
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ihc_last_order_phone', deliveryForm.phone);
      }
      setUpiStep('pay');
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  const getUpiDeepLink = (oid: string, total: number) => {
    const note = `Ilma Hijab ${oid}`;
    return `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent('Ilma Hijab Collection')}&am=${total}&cu=INR&tn=${encodeURIComponent(note)}`;
  };

  const getQrCodeUrl = (oid: string, total: number) => {
    const upiUri = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent('Ilma Hijab Collection')}&am=${total}&cu=INR&tn=${encodeURIComponent('Ilma Hijab ' + oid)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`;
  };

  const colorMap: Record<string, string> = {
    'Black': '#0a0a0a',
    'Classic Black': '#0a0a0a',
    'Beige': '#E8DFD3',
    'Gold': '#C9A96E',
    'Emerald': '#1B4332',
    'White': '#FAF7F2',
    'Maroon': '#800000',
    'Navy': '#000080',
    'Mauve': '#E0B0FF',
    'Teal': '#008080',
    'Grey': '#808080',
    'Sage Green': '#9CAF88',
    'Dusty Rose': '#C49A9A',
    'Mocha Taupe': '#8B7355',
    'Warm Taupe': '#B5A08C',
  };

  const getGradient = (category: string) => {
    switch(category?.toLowerCase()) {
      case 'abayas':
      case 'abaya': return 'from-[#1B4332]/20 to-[#1B4332]/5';
      case 'hijabs':
      case 'hijab': return 'from-[#C9A96E]/20 to-[#C9A96E]/5';
      default: return 'from-gray-200 to-gray-50';
    }
  };

  const currentImage = images[activeImageIndex];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <nav className="text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-gold transition">Home</Link>
        <span className="mx-2">&gt;</span>
        <Link href={`/${product.category?.toLowerCase()}s`} className="hover:text-gold transition">{product.category}</Link>
        <span className="mx-2">&gt;</span>
        <span className="text-black font-medium">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
        {/* Left Column: Image Gallery */}
        <div className="space-y-4">
          <div className={`relative aspect-[3/4] w-full rounded-2xl overflow-hidden bg-gradient-to-br ${getGradient(product.category)} group border border-gray-100`}>
            {currentImage && !imageErrors[activeImageIndex] && (currentImage.startsWith('/') || currentImage.startsWith('http')) ? (
              <Image
                src={currentImage}
                alt={product.name || 'Product'}
                fill
                onError={() => setImageErrors(prev => ({ ...prev, [activeImageIndex]: true }))}
                className="object-cover transform group-hover:scale-105 transition-transform duration-500"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <span className="text-xl font-serif text-[#C9A96E] font-bold mb-2">ILMA</span>
                <span className="text-sm tracking-widest uppercase">{product.category || 'COLLECTION'}</span>
              </div>
            )}

            {product.badge && product.badge !== 'NONE' && (
              <span className="absolute top-4 left-4 bg-gold text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                {product.badge.replace('_', ' ')}
              </span>
            )}

            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="bg-red-600 text-white font-bold text-sm px-4 py-2 rounded uppercase tracking-widest">
                  Out of Stock
                </span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex space-x-4 overflow-x-auto pb-2">
              {images.map((img: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative flex-shrink-0 w-20 h-24 rounded-lg overflow-hidden border-2 transition-colors ${activeImageIndex === idx ? 'border-gold' : 'border-transparent'}`}
                >
                  {img && !imageErrors[idx] && (img.startsWith('/') || img.startsWith('http')) ? (
                    <Image 
                      src={img} 
                      alt="" 
                      fill 
                      onError={() => setImageErrors(prev => ({ ...prev, [idx]: true }))}
                      className="object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">
                      {idx + 1}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Details */}
        <div className="flex flex-col">
          <h1 className="font-playfair text-3xl md:text-5xl text-black mb-4">{product.name}</h1>
          
          <div className="flex items-center space-x-2 mb-6">
            <div className="flex text-gold">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <span className="text-sm text-gray-500">({product.reviewCount || 128} reviews)</span>
          </div>

          <div className="mb-6 flex items-end space-x-4">
            <span className="text-3xl font-bold text-black">
              {formatPrice(product.salePrice ?? product.originalPrice ?? product.price ?? 0)}
            </span>
            {product.salePrice && product.originalPrice > product.salePrice && (
              <>
                <span className="text-xl text-gray-400 line-through mb-1">
                  {formatPrice(product.originalPrice)}
                </span>
                <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mb-1">
                  {Math.round(((product.originalPrice - product.salePrice) / product.originalPrice) * 100)}% OFF
                </span>
              </>
            )}
          </div>

          <p className="text-gray-600 mb-8">{product.shortDescription || product.description}</p>

          {/* Color Selector - circular swatches with gold border */}
          {product.colors && product.colors.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">
                Color: <span className="text-[#C9A96E]">{selectedColor}</span>
              </h3>
              <div className="flex flex-wrap gap-3">
                {product.colors.map((color: string) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    title={color}
                    aria-label={`Select ${color}`}
                    className={`w-10 h-10 rounded-full border-2 transition-all duration-200 shadow-sm ${
                      selectedColor === color
                        ? 'border-[#C9A96E] scale-110 ring-2 ring-[#C9A96E]/30'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: colorMap[color] || '#888' }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {product.sizes && product.sizes.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">
                Size: <span className="text-[#C9A96E]">{selectedSize}</span>
              </h3>
              <div className="flex flex-wrap gap-3">
                {product.sizes.map((size: string) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      selectedSize === size
                        ? 'border-[#C9A96E] bg-[#C9A96E]/10 text-black font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock Status */}
          <div className="mb-6">
            {isOutOfStock ? (
              <span className="text-red-600 font-semibold text-sm">Out of Stock</span>
            ) : product.stock < 5 ? (
              <span className="text-amber-600 font-semibold text-sm">Only {product.stock} left in stock - order soon</span>
            ) : (
              <span className="text-emerald-600 font-semibold text-sm">In Stock ({product.stock} available)</span>
            )}
          </div>

          {/* Quantity Selector */}
          {!isOutOfStock && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-3">Quantity</h3>
              <div className="flex items-center border border-gray-300 rounded-full w-32">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-4 py-2 text-gray-500 hover:text-black transition">
                  <Minus className="w-4 h-4" />
                </button>
                <span className="flex-1 text-center font-medium">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="px-4 py-2 text-gray-500 hover:text-black transition">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Order Summary Box */}
          {!isOutOfStock && (
            <div className="mb-6 bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Color</span><span className="font-medium text-black">{selectedColor}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Size</span><span className="font-medium text-black">{selectedSize}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>{formatPrice(unitPrice)} × {quantity}</span>
                <span className="font-medium text-black">{formatPrice(subtotalCalc)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className={`font-medium ${shippingCalc === 0 ? 'text-emerald-600' : 'text-black'}`}>
                  {shippingCalc === 0 ? 'FREE' : formatPrice(shippingCalc)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-1">
                <span>Total</span>
                <span className="text-[#C9A96E]">{formatPrice(totalCalc)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 mb-8">
            {/* Primary: UPI Pay */}
            {!isOutOfStock && (
              <button
                onClick={handleOpenUpiModal}
                className="w-full px-8 py-4 rounded-full font-bold tracking-wider bg-[#C9A96E] text-black hover:bg-[#DFBA73] transition flex items-center justify-center gap-2 shadow-lg shadow-[#C9A96E]/20"
              >
                <CreditCard className="w-5 h-5" />
                Pay {formatPrice(totalCalc)} with UPI
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 px-8 py-3 rounded-full font-medium tracking-wider border-2 transition ${
                  isOutOfStock ? 'border-gray-200 text-gray-400 cursor-not-allowed' : 'border-black text-black hover:bg-black hover:text-white'
                }`}
              >
                {isOutOfStock ? 'OUT OF STOCK' : 'ADD TO CART'}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={isOutOfStock}
                className={`flex-1 px-8 py-3 rounded-full font-medium tracking-wider transition ${
                  isOutOfStock ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:bg-black/80'
                }`}
              >
                CHECKOUT
              </button>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-2 gap-4 pt-8 border-t border-gray-200">
            <div className="flex items-center text-sm text-gray-600">
              <ShieldCheck className="w-5 h-5 mr-2 text-gold" /> Secure Payment
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Star className="w-5 h-5 mr-2 text-gold" /> Quality Checked
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Truck className="w-5 h-5 mr-2 text-gold" /> Easy Order Tracking
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <Clock className="w-5 h-5 mr-2 text-gold" /> 24/7 Support
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="mb-16 border-t border-gray-200 pt-12">
        <div className="flex border-b border-gray-200 mb-8 space-x-8">
          {['description', 'fabric', 'shipping'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-4 text-sm font-semibold uppercase tracking-wider transition-colors relative ${
                activeTab === tab ? 'text-black' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'description' && 'Description'}
              {tab === 'fabric' && 'Fabric & Care'}
              {tab === 'shipping' && 'Shipping & Returns'}
              {activeTab === tab && (
                <motion.div layoutId="detailTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
              )}
            </button>
          ))}
        </div>

        <div className="text-gray-600 leading-relaxed max-w-3xl">
          {activeTab === 'description' && (
            <p>{product.description}</p>
          )}
          {activeTab === 'fabric' && (
            <div className="space-y-4">
              <p><strong>Fabric:</strong> {product.fabricInfo || 'Premium Grade Modest Fabric'}</p>
              <p><strong>Care:</strong> {product.careInstructions || 'Dry clean or gentle hand wash with cold water. Iron on low heat.'}</p>
            </div>
          )}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              <p>• Free shipping across India on orders above ₹999.</p>
              <p>• Standard delivery within 5-7 business days.</p>
              <p>• Easy 7-day hassle-free exchange &amp; return policy.</p>
            </div>
          )}
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="border-t border-gray-200 pt-12">
          <h2 className="font-playfair text-3xl mb-8">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((relProduct) => (
              <ProductCard key={relProduct.id} product={relProduct} />
            ))}
          </div>
        </div>
      )}

      {/* UPI Payment Modal */}
      <AnimatePresence>
        {showUpiModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowUpiModal(false); }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="font-semibold text-lg text-black">
                    {upiStep === 'form' ? 'Delivery Details' : 'Pay with UPI'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {upiStep === 'form' ? 'Fill your address to place order' : 'Open your UPI app to complete payment'}
                  </p>
                </div>
                <button onClick={() => setShowUpiModal(false)} className="p-2 rounded-full hover:bg-gray-100 transition">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Mini order summary */}
              <div className="bg-gray-50 px-6 py-3 flex items-center gap-3 border-b border-gray-100">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-black truncate">{product.name}</p>
                  <p className="text-xs text-gray-500">{selectedColor} · {selectedSize} · Qty: {quantity}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#C9A96E]">{formatPrice(upiStep === 'pay' ? upiTotal : totalCalc)}</p>
                  {shippingCalc === 0 && <p className="text-[10px] text-emerald-600">Free Shipping</p>}
                </div>
              </div>

              <div className="px-6 py-5">
                {upiStep === 'form' ? (
                  /* ── Step 1: Delivery Form ── */
                  <form onSubmit={handlePlaceUpiOrder} className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
                      <input required type="text" name="fullName" value={deliveryForm.fullName} onChange={handleDeliveryFormChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                        placeholder="Your full name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Phone / WhatsApp *</label>
                        <input required type="tel" pattern="[0-9]{10}" name="phone" value={deliveryForm.phone} onChange={handleDeliveryFormChange}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                          placeholder="10-digit" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                        <input required type="email" name="email" value={deliveryForm.email} onChange={handleDeliveryFormChange}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                          placeholder="email@example.com" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 1 *</label>
                      <input required type="text" name="address1" value={deliveryForm.address1} onChange={handleDeliveryFormChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                        placeholder="House, Building, Street" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Address Line 2 <span className="text-gray-400">(optional)</span></label>
                      <input type="text" name="address2" value={deliveryForm.address2} onChange={handleDeliveryFormChange}
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                        placeholder="Landmark, Area" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code *</label>
                        <input required type="text" pattern="[0-9]{6}" name="pincode" value={deliveryForm.pincode} onChange={handleDeliveryFormChange}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                          placeholder="6-digit" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">City *</label>
                        <input required type="text" name="city" value={deliveryForm.city} onChange={handleDeliveryFormChange}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none"
                          placeholder="City" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">State *</label>
                        <select required name="state" value={deliveryForm.state} onChange={handleDeliveryFormChange}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-[#C9A96E] focus:border-transparent outline-none bg-white">
                          <option value="">State</option>
                          {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                      📦 Your order (PENDING) is created first. Complete UPI payment on the next screen. Admin confirms after receiving payment.
                    </div>

                    <button
                      type="submit"
                      disabled={placingOrder}
                      className="w-full bg-[#C9A96E] text-black py-3.5 rounded-xl font-bold tracking-wider hover:bg-[#DFBA73] transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {placingOrder
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Order...</>
                        : <>Continue to Pay {formatPrice(totalCalc)}</>
                      }
                    </button>
                  </form>
                ) : (
                  /* ── Step 2: UPI Pay Screen ── */
                  <div className="space-y-5">
                    {/* Order created confirmation */}
                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-emerald-800">Order Created!</p>
                        <p className="text-xs text-emerald-700">Order ID: <strong>#{upiOrderId}</strong> · Status: Pending</p>
                      </div>
                    </div>

                    {/* UPI deep-link */}
                    <div className="bg-[#161922] rounded-2xl p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold text-sm">Instant UPI Payment</p>
                          <p className="text-gray-400 text-xs">Recipient: {UPI_ID}</p>
                        </div>
                        <span className="text-[#C9A96E] font-bold text-lg">{formatPrice(upiTotal)}</span>
                      </div>

                      <a
                        href={upiOrderId ? getUpiDeepLink(upiOrderId, upiTotal) : '#'}
                        className="w-full bg-gradient-to-r from-[#C9A96E] to-[#DFBA73] text-black font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 hover:opacity-95 transition shadow-lg text-sm tracking-wide"
                      >
                        <CreditCard className="w-5 h-5" />
                        Pay {formatPrice(upiTotal)} with UPI App
                      </a>

                      {/* QR Code collapsible */}
                      <details className="group text-xs text-gray-400 border border-gray-800 rounded-xl p-3 bg-black/40">
                        <summary className="cursor-pointer font-medium text-[#C9A96E] hover:underline list-none flex items-center justify-between">
                          <span>Show QR Code (GPay / PhonePe / Paytm)</span>
                          <span className="text-gray-500">▼</span>
                        </summary>
                        <div className="pt-4 flex flex-col items-center space-y-3">
                          <div className="bg-white p-3 rounded-xl inline-block shadow">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={upiOrderId ? getQrCodeUrl(upiOrderId, upiTotal) : ''}
                              alt="UPI QR Code"
                              width={180}
                              height={180}
                              className="w-44 h-44 object-contain"
                            />
                          </div>
                          <p className="text-xs text-gray-400 text-center">Scan with any UPI app</p>
                          <p className="text-xs text-amber-400/90 font-medium text-center">
                            Amount: {formatPrice(upiTotal)} · Ref: {upiOrderId}
                          </p>
                        </div>
                      </details>
                    </div>

                    <p className="text-xs text-gray-500 text-center">
                      After paying, tap below to track your order status in real time.
                    </p>

                    <button
                      onClick={() => { setShowUpiModal(false); router.push(`/order-status/${upiOrderId}`); }}
                      className="w-full border-2 border-black text-black py-3 rounded-xl font-bold tracking-wider hover:bg-black hover:text-white transition"
                    >
                      Track My Order →
                    </button>

                    <a
                      href={`https://wa.me/91${BUSINESS_WHATSAPP}?text=${encodeURIComponent(
                        `Hi Ilma Hijab! I placed Order #${upiOrderId} and completed UPI payment of ₹${upiTotal}. Please confirm. Thank you!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold tracking-wider transition flex items-center justify-center gap-2 text-sm"
                    >
                      💬 Notify on WhatsApp After Payment
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
