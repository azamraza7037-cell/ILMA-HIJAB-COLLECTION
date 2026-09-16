'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice: number;
  stock: number;
  image: string;
  category: string;
}

export default function AIStylist() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Assalamualaikum! I am Ilma AI Stylist. Tell me what you are looking for — abaya, hijab, naqab, colour, budget, or occasion.',
    },
  ]);
  const [products, setProducts] = useState<RecommendedProduct[]>([]);

  async function sendMessage() {
    const text = message.trim();
    if (!text || loading) return;

    const nextHistory = [
      ...history,
      { role: 'user' as const, content: text },
    ];

    setHistory(nextHistory);
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai-stylist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(-6),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Unable to contact stylist');
      }

      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            data.reply ||
            'I found some options for you in our collection.',
        },
      ]);

      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }
    } catch {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'I am having trouble connecting right now. Please browse our collection or contact us on WhatsApp.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-black px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <div>
                <div className="font-semibold">Ilma AI Stylist</div>
                <div className="text-xs text-gray-300">
                  Your modest-fashion assistant
                </div>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              aria-label="Close AI Stylist"
            >
              <X size={20} />
            </button>
          </div>

          <div className="h-80 overflow-y-auto space-y-3 p-4">
            {history.map((item, index) => (
              <div
                key={index}
                className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                  item.role === 'user'
                    ? 'ml-auto bg-black text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {item.content}
              </div>
            ))}

            {loading && (
              <div className="max-w-[88%] rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-500">
                Finding the best options...
              </div>
            )}

            {products.length > 0 && (
              <div className="space-y-2 pt-2">
                {products.slice(0, 4).map((product) => (
                  <Link
                    key={product.id}
                    href={`/product/${product.slug}`}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl border p-3 hover:border-[#C9A96E]"
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-gray-500">
                      ₹{product.price.toFixed(0)} · {product.category}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
            className="flex gap-2 border-t p-3"
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about your perfect style..."
              className="min-w-0 flex-1 rounded-full border px-4 py-3 text-sm outline-none focus:border-[#C9A96E]"
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="rounded-full bg-black p-3 text-white disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-black text-white shadow-xl transition-transform hover:scale-105"
        aria-label="Open AI Stylist"
      >
        {open ? <X size={23} /> : <MessageCircle size={23} />}
      </button>
    </>
  );
}
