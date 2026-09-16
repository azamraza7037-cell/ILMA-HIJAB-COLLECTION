import create from 'zustand';
import { devtools } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  // add other fields as needed
}

type CartState = {
  items: CartItem[];
  addItem: (product: any, qty: number, color?: string, size?: string) => void;
  openCart: () => void;
};

export const useCartStore = create<CartState>()(
  devtools((set, get) => ({
    items: [],
    addItem: (product, qty, color, size) => {
      const existing = get().items.find((i) => i.id === product.id);
      if (existing) {
        // increase quantity
        set((state) => ({
          items: state.items.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + qty } : i
          ),
        }));
      } else {
        const newItem: CartItem = {
          id: product.id ?? Math.random().toString(),
          name: product.name ?? 'Item',
          price: product.price ?? 0,
          quantity: qty,
        };
        set((state) => ({ items: [...state.items, newItem] }));
      }
    },
    openCart: () => {
      // placeholder: UI for cart not implemented in this stub
      console.log('Cart opened');
    },
  }))
);
