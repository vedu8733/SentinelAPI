'use client';

import React from 'react';

interface HeroSectionProps {
  onExploreClick: () => void;
  onCategoriesClick: () => void;
}

export function HeroSection({ onExploreClick, onCategoriesClick }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#FCE9D8]/60 via-[#FDF4EB] to-[#FFF9F2] py-12 sm:py-16 lg:py-20 border-b border-[#EDE3D9]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-[#FFF9F2] text-[#D96C4F] border border-[#EDE3D9] shadow-2xs">
              <span className="text-sm">✨</span>
              <span>Everyday Essentials Collection</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#342A26] leading-[1.12]">
              Find little things that make{' '}
              <span className="text-[#D96C4F]">everyday life</span> better.
            </h1>

            <p className="text-base sm:text-lg text-[#81736B] max-w-xl leading-relaxed">
              Explore useful everyday essentials, discover new favourites, and enjoy a simpler way to shop.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onExploreClick}
                className="px-6 py-3.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] active:scale-98 text-white font-semibold text-sm transition shadow-sm cursor-pointer flex items-center gap-2"
              >
                <span>Explore Products</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <button
                onClick={onCategoriesClick}
                className="px-6 py-3.5 rounded-full bg-white hover:bg-[#FCE9D8] text-[#342A26] border border-[#EDE3D9] font-semibold text-sm transition cursor-pointer"
              >
                Browse Categories
              </button>
            </div>

            {/* Verified Reassurance Badges */}
            <div className="pt-4 border-t border-[#EDE3D9]/80 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#81736B]">
              <div className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#A8B89A]/30 text-[#342A26] font-bold text-[10px]">
                  ✓
                </span>
                <span>Real-Time Inventory</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#A8B89A]/30 text-[#342A26] font-bold text-[10px]">
                  ✓
                </span>
                <span>Protected Gateway Security</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#A8B89A]/30 text-[#342A26] font-bold text-[10px]">
                  ✓
                </span>
                <span>Transparent Pricing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Asset */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Decorative warm aura */}
              <div className="absolute -inset-4 bg-gradient-to-tr from-[#FCE9D8] to-[#FFF9F2] rounded-3xl -z-10 blur-xl opacity-70" />

              {/* Main Card with Lifestyle/Product Collage */}
              <div className="rounded-3xl bg-white border border-[#EDE3D9] p-3 shadow-md overflow-hidden group">
                <div className="relative h-72 sm:h-80 w-full rounded-2xl overflow-hidden bg-[#FCE9D8]/50">
                  <img
                    src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=80"
                    alt="Premium Audio & Everyday Tech"
                    className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                  />
                  {/* Subtle gradient vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Top-Right Badge */}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold text-[#342A26] shadow-sm flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#D96C4F]" />
                    <span>Everyday Tech</span>
                  </div>

                  {/* Bottom Highlight */}
                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md p-3 rounded-xl border border-[#EDE3D9] shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#342A26]">Featured: Quantum Sound Audio</p>
                      <p className="text-[11px] text-[#81736B]">Studio Acoustics & 40h Battery</p>
                    </div>
                    <span className="text-sm font-bold text-[#D96C4F]">$149.99</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
