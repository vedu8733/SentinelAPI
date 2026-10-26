'use client';

import React from 'react';
import { Product } from '../lib/api';

interface CategoryCardsProps {
  products: Product[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

const CATEGORY_IMAGES: Record<string, string> = {
  Audio: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
  Gaming: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60',
  Wearables: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
  Accessories: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60',
};

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  Audio: 'Headphones, studio acoustics & sound gear',
  Gaming: 'Tactile mechanical gear & peripherals',
  Wearables: 'Smart fitness watches & health monitors',
  Accessories: 'Ergonomic mice & desk productivity essentials',
};

export function CategoryCards({
  products,
  selectedCategory,
  onSelectCategory,
}: CategoryCardsProps) {
  // Aggregate unique categories from actual products
  const categoryMap = products.reduce((acc, p) => {
    if (!p.category) return acc;
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categories = Object.keys(categoryMap);

  if (categories.length === 0) return null;

  return (
    <section id="categories" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 border-b border-[#EDE3D9]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-[#FCE9D8] text-[#D96C4F] mb-1.5">
            Curated Categories
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#342A26]">
            Shop by Category
          </h2>
          <p className="text-xs sm:text-sm text-[#81736B] mt-1">
            Browse our verified collections by lifestyle and daily need.
          </p>
        </div>

        {selectedCategory && (
          <button
            onClick={() => onSelectCategory(null)}
            className="text-xs font-semibold text-[#D96C4F] hover:text-[#C85B3E] transition underline underline-offset-4 cursor-pointer self-start sm:self-auto"
          >
            Clear category filter &times;
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {categories.map((category) => {
          const count = categoryMap[category];
          const isSelected = selectedCategory === category;
          const imageSrc =
            CATEGORY_IMAGES[category] ||
            products.find((p) => p.category === category)?.imageUrl ||
            'https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=500&auto=format&fit=crop&q=60';

          return (
            <div
              key={category}
              onClick={() => onSelectCategory(isSelected ? null : category)}
              className={`group cursor-pointer rounded-2xl bg-white border p-3 sm:p-4 transition-all duration-200 flex flex-col justify-between hover:shadow-md hover:-translate-y-1 ${
                isSelected
                  ? 'border-[#D96C4F] ring-2 ring-[#D96C4F]/20 shadow-sm'
                  : 'border-[#EDE3D9] hover:border-[#D96C4F]/60'
              }`}
            >
              {/* Category Image Box */}
              <div className="relative h-40 w-full overflow-hidden rounded-xl bg-[#FCE9D8]/40 mb-3">
                <img
                  src={imageSrc}
                  alt={category}
                  className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[#342A26] shadow-2xs">
                  {count} {count === 1 ? 'item' : 'items'}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#342A26] group-hover:text-[#D96C4F] transition-colors">
                    {category}
                  </h3>
                  <svg
                    className={`h-4 w-4 text-[#81736B] group-hover:text-[#D96C4F] group-hover:translate-x-0.5 transition-all ${
                      isSelected ? 'text-[#D96C4F] translate-x-0.5' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-xs text-[#81736B] line-clamp-1">
                  {CATEGORY_DESCRIPTIONS[category] || `Explore all ${category} products`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
