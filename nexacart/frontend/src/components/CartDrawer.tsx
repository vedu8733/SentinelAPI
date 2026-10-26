'use client';

import React from 'react';
import { Product } from '../lib/api';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, newQuantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onProceedToCheckout: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onProceedToCheckout,
}: CartDrawerProps) {
  if (!isOpen) return null;

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-[#342A26]/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
    >
      <div
        className="w-full max-w-md h-full bg-[#FFF9F2] border-l border-[#EDE3D9] p-6 flex flex-col justify-between shadow-2xl relative animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="pb-4 border-b border-[#EDE3D9] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCE9D8] text-[#D96C4F]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <div>
              <h2 id="cart-drawer-title" className="text-base font-bold text-[#342A26]">
                Your Shopping Bag
              </h2>
              <span className="text-xs text-[#81736B]">
                {totalItems} {totalItems === 1 ? 'item' : 'items'} in cart
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#FCE9D8] text-[#81736B] hover:text-[#342A26] transition cursor-pointer"
            aria-label="Close cart"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart Items Scrollable List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
              <div className="h-16 w-16 rounded-full bg-[#FCE9D8] flex items-center justify-center text-[#D96C4F]">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#342A26]">Your bag is empty</h3>
                <p className="text-xs text-[#81736B] max-w-xs leading-relaxed">
                  Discover our thoughtfully curated tech & everyday essentials to fill it up.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] text-white text-xs font-semibold transition cursor-pointer"
              >
                Start Shopping
              </button>
            </div>
          ) : (
            cart.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="p-3.5 rounded-2xl bg-white border border-[#EDE3D9] flex items-center gap-3.5 shadow-2xs hover:border-[#D96C4F]/40 transition"
              >
                {/* Thumbnail */}
                <div className="relative h-16 w-16 rounded-xl overflow-hidden bg-[#FCE9D8]/30 flex-shrink-0 border border-[#EDE3D9]">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover object-center"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-[#342A26] truncate">
                    {product.name}
                  </h4>
                  <div className="text-[11px] text-[#81736B] mt-0.5">
                    ${product.price.toFixed(2)} each
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border border-[#EDE3D9] rounded-lg bg-[#FFF9F2] text-xs">
                      <button
                        onClick={() => onUpdateQuantity(product.id, quantity - 1)}
                        className="px-2 py-0.5 text-[#342A26] hover:bg-[#FCE9D8] transition font-bold"
                        aria-label="Decrease quantity"
                      >
                        &minus;
                      </button>
                      <span className="px-2 text-xs font-bold text-[#342A26]">
                        {quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.inventory}
                        className="px-2 py-0.5 text-[#342A26] hover:bg-[#FCE9D8] disabled:opacity-40 transition font-bold"
                        aria-label="Increase quantity"
                      >
                        &#43;
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveItem(product.id)}
                      className="text-[#81736B] hover:text-rose-600 p-1 text-[11px] transition cursor-pointer"
                      title="Remove item"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {/* Line Total */}
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-bold text-[#342A26]">
                    ${(product.price * quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer & Checkout Action */}
        {cart.length > 0 && (
          <div className="pt-4 border-t border-[#EDE3D9] space-y-3.5 bg-[#FFF9F2]">
            <div className="space-y-1.5 text-xs text-[#81736B]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-[#342A26]">
                  ${cartSubtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span className="text-[#A8B89A] font-semibold">Free (Store Demo)</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#EDE3D9] text-sm font-bold text-[#342A26]">
                <span>Total</span>
                <span className="text-base text-[#D96C4F]">
                  ${cartSubtotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#FCE9D8]/50 border border-[#EDE3D9] text-[11px] text-[#81736B] leading-relaxed flex items-start gap-2">
              <svg className="w-4 h-4 text-[#D96C4F] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Demonstration store: simulated checkout creates an order record without requesting real credit cards.
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={onProceedToCheckout}
                className="w-full py-3.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] active:scale-98 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-white hover:bg-[#FCE9D8] text-[#342A26] border border-[#EDE3D9] text-xs font-semibold transition cursor-pointer text-center"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
