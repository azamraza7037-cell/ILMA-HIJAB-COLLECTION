'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface OrderData {
  orderId: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
}

export default function OrderStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const [orderId, setOrderId] = useState('');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((value) => setOrderId(value.orderId));

    const savedPhone = sessionStorage.getItem('ihc_last_order_phone');
    if (savedPhone) setPhone(savedPhone);
  }, [params]);

  useEffect(() => {
    if (!orderId || !phone) {
      setLoading(false);
      return;
    }

    fetch(
      `/api/order-status/${encodeURIComponent(orderId)}?phone=${encodeURIComponent(phone)}`
    )
      .then(async (res) => {
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Unable to load order.');
        }

        setOrder(data.order);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderId, phone]);

  return (
    <main className="min-h-screen bg-ivory pt-32 pb-20 px-4">
      <div className="max-w-xl mx-auto bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-3xl font-serif text-center mb-3">
          Order Status
        </h1>

        <p className="text-center text-gray-500 mb-8">
          Order #{orderId}
        </p>

        {loading && (
          <p className="text-center text-gray-500">
            Checking your order...
          </p>
        )}

        {!loading && error && (
          <div className="text-center text-red-600">
            {error}
          </div>
        )}

        {!loading && order && (
          <div className="space-y-5">
            <div className="flex justify-between border-b pb-4">
              <span>Status</span>
              <strong>{order.status}</strong>
            </div>

            <div className="flex justify-between border-b pb-4">
              <span>Payment</span>
              <strong>{order.paymentStatus}</strong>
            </div>

            <div className="flex justify-between">
              <span>Total</span>
              <strong>₹{order.totalAmount.toFixed(2)}</strong>
            </div>
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-full bg-black text-white hover:opacity-90"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}