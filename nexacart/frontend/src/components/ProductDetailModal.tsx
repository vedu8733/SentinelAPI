'use client';

import React, { useState } from 'react';
import { Product } from '../lib/api';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({
  product,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [addedNotice, setAddedNotice] = useState(false);

  if (!product) return null;

  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800&auto=format&fit=crop&q=80';

  const handleAdd = () => {
    onAddToCart(product, quantity);
    setAddedNotice(true);
    setTimeout(() => {
      setAddedNotice(false);
      onClose();
    }, 900);
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrement = () => {
    if (quantity < product.inventory) {
      setQuantity(quantity + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#342A26]/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-detail-title"
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white border border-[#EDE3D9] p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 rounded-full bg-[#FFF9F2] hover:bg-[#FCE9D8] text-[#81736B] hover:text-[#342A26] transition cursor-pointer border border-[#EDE3D9]"
          aria-label="Close product details"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left: Product Image */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#FCE9D8]/30 border border-[#EDE3D9]">
              <img
                src={product.imageUrl || fallbackImage}
                alt={product.name}
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold text-[#342A26] border border-[#EDE3D9]">
                {product.category}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FFF9F2] border border-[#EDE3D9] text-xs text-[#81736B] space-y-1">
              <span className="font-semibold text-[#342A26] block">Direct Store Catalogue Item</span>
              <p>Authentic tech gear with verified inventory directly connected to NexaCart storage.</p>
            </div>
          </div>

          {/* Right: Details & Real Add to Cart */}
          <div className="space-y-5">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FCE9D8] text-[#D96C4F] mb-2">
                {product.category}
              </span>
              <h2
                id="product-detail-title"
                className="text-2xl sm:text-3xl font-extrabold text-[#342A26] tracking-tight leading-snug"
              >
                {product.name}
              </h2>
            </div>

            {/* Price & Stock */}
            <div className="flex items-center justify-between pb-4 border-b border-[#EDE3D9]">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#81736B] block">Price</span>
                <span className="text-3xl font-extrabold text-[#D96C4F]">
                  ${product.price.toFixed(2)}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[11px] uppercase tracking-wider text-[#81736B] block">Availability</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#A8B89A]/20 text-[#342A26]">
                  <span className="h-2 w-2 rounded-full bg-[#A8B89A]" />
                  {product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-xs uppercase font-bold text-[#81736B] tracking-wider mb-1.5">
                Description
              </h3>
              <p className="text-sm text-[#342A26] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Quantity Selector */}
            <div className="space-y-2 pt-2">
              <label className="text-xs uppercase font-bold text-[#81736B] tracking-wider block">
                Quantity
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[#EDE3D9] rounded-xl bg-[#FFF9F2] p-1">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={quantity <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#342A26] hover:bg-[#FCE9D8] disabled:opacity-40 transition font-bold"
                    aria-label="Decrease quantity"
                  >
                    &minus;
                  </button>
                  <span className="w-12 text-center text-sm font-bold text-[#342A26]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={quantity >= product.inventory}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#342A26] hover:bg-[#FCE9D8] disabled:opacity-40 transition font-bold"
                    aria-label="Increase quantity"
                  >
                    &#43;
                  </button>
                </div>

                <div className="text-xs text-[#81736B]">
                  Subtotal: <strong className="text-[#342A26] text-sm">${(product.price * quantity).toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Add to Cart Action */}
            <div className="pt-4">
              <button
                type="button"
                onClick={handleAdd}
                disabled={product.inventory <= 0}
                className="w-full py-3.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] active:scale-98 disabled:opacity-50 text-white font-bold text-sm transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                {addedNotice ? (
                  <>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Added to Cart!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span>Add {quantity} to Cart &bull; ${(product.price * quantity).toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
