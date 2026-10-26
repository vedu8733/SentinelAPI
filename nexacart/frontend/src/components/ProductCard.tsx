'use client';

import React from 'react';
import { Product } from '../lib/api';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart, onViewDetails }: ProductCardProps) {
  const fallbackImage =
    'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=60';

  return (
    <article className="group rounded-2xl bg-white border border-[#EDE3D9] p-4 sm:p-5 flex flex-col justify-between hover:shadow-md hover:border-[#D96C4F]/50 hover:-translate-y-1 transition-all duration-200">
      <div className="space-y-3">
        {/* Product Image Box */}
        <div
          onClick={() => onViewDetails(product)}
          className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#FCE9D8]/30 cursor-pointer"
        >
          <img
            src={product.imageUrl || fallbackImage}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          />

          {/* Top-Left Category Badge */}
          {product.category && (
            <div className="absolute top-2.5 left-2.5 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-[#342A26] border border-[#EDE3D9] shadow-2xs">
              {product.category}
            </div>
          )}

          {/* Top-Right Inventory Pill */}
          <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] font-medium text-[#342A26] border border-[#EDE3D9] shadow-2xs flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                product.inventory > 0 ? 'bg-[#A8B89A]' : 'bg-rose-400'
              }`}
            />
            <span>{product.inventory > 0 ? `${product.inventory} in stock` : 'Out of stock'}</span>
          </div>
        </div>

        {/* Product Metadata */}
        <div>
          <h3
            onClick={() => onViewDetails(product)}
            className="text-sm font-bold text-[#342A26] group-hover:text-[#D96C4F] transition-colors cursor-pointer line-clamp-1"
          >
            {product.name}
          </h3>
          <p className="text-xs text-[#81736B] mt-1 line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        </div>
      </div>

      {/* Price & Actions Row */}
      <div className="pt-4 mt-4 border-t border-[#EDE3D9]/70 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-[#81736B] uppercase tracking-wider block font-medium">Price</span>
          <span className="text-base font-extrabold text-[#342A26]">
            ${product.price.toFixed(2)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onViewDetails(product)}
            className="px-2.5 py-1.5 rounded-full bg-[#FFF9F2] hover:bg-[#FCE9D8] text-[#342A26] border border-[#EDE3D9] text-xs font-semibold transition cursor-pointer"
            aria-label={`View details for ${product.name}`}
          >
            Details
          </button>

          <button
            onClick={() => onAddToCart(product)}
            disabled={product.inventory <= 0}
            className="px-3.5 py-1.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] active:scale-98 disabled:opacity-50 text-white text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5"
            aria-label={`Add ${product.name} to cart`}
          >
            <span>Add</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
