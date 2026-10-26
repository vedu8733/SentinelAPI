'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
  isBackendOnline: boolean | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onScrollToShop: () => void;
  onScrollToCategories: () => void;
}

export function Navbar({
  cartCount,
  onOpenCart,
  isBackendOnline,
  searchTerm,
  onSearchChange,
  onScrollToShop,
  onScrollToCategories,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearchMobile, setShowSearchMobile] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#EDE3D9] bg-[#FFF9F2]/95 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 gap-4">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D96C4F] text-white shadow-sm group-hover:scale-105 transition-transform">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-[#342A26] flex items-center">
                Nexa<span className="text-[#D96C4F]">Cart</span>
              </div>
              <span className="block text-[10px] tracking-wider text-[#81736B] font-medium uppercase">
                Everyday Essentials
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, gear, audio..."
              aria-label="Search products, gear, audio"
              className="w-full pl-9 pr-8 py-2 rounded-full bg-white border border-[#EDE3D9] text-xs text-[#342A26] placeholder-[#81736B] focus:outline-none focus:ring-2 focus:ring-[#D96C4F]/30 focus:border-[#D96C4F] transition shadow-2xs"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-[#81736B]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-2.5 text-[#81736B] hover:text-[#342A26]"
                title="Clear search"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Center / Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#81736B]">
          <button
            onClick={onScrollToShop}
            className="hover:text-[#D96C4F] transition-colors cursor-pointer"
          >
            Shop All
          </button>
          <button
            onClick={onScrollToCategories}
            className="hover:text-[#D96C4F] transition-colors cursor-pointer"
          >
            Categories
          </button>
          <a
            href="#benefits"
            className="hover:text-[#D96C4F] transition-colors"
          >
            Why NexaCart
          </a>
        </nav>

        {/* Right Actions: Store Status, Mobile Search Toggle, Cart Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Friendly Backend Health Pill */}
          <div className="hidden sm:flex items-center">
            {isBackendOnline === true ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#A8B89A]/20 text-[#342A26] border border-[#A8B89A]/40">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A8B89A]" />
                Store Online
              </span>
            ) : isBackendOnline === false ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EDE3D9]/60 text-[#81736B]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#81736B] animate-pulse" />
                Connecting...
              </span>
            )}
          </div>

          {/* Mobile Search Toggle */}
          <button
            onClick={() => setShowSearchMobile(!showSearchMobile)}
            className="md:hidden p-2 text-[#342A26] hover:text-[#D96C4F] rounded-lg transition"
            aria-label="Toggle mobile search"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>

          {/* Cart Button */}
          <button
            onClick={onOpenCart}
            className="relative flex items-center gap-2 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] active:scale-98 px-4 py-2 text-xs font-semibold text-white transition shadow-sm cursor-pointer"
            aria-label={`Open shopping cart with ${cartCount} items`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <span>Cart</span>
            {cartCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-[#D96C4F]">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#342A26] hover:text-[#D96C4F] rounded-lg transition"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Search Expansion */}
      {showSearchMobile && (
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-[#EDE3D9]/60 bg-[#FFF9F2]">
          <div className="relative w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              className="w-full pl-9 pr-8 py-2 rounded-full bg-white border border-[#EDE3D9] text-xs text-[#342A26] placeholder-[#81736B] focus:outline-none focus:ring-2 focus:ring-[#D96C4F]/30"
              autoFocus
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-[#81736B]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-4 py-4 border-t border-[#EDE3D9] bg-[#FFF9F2] space-y-3">
          <div className="flex flex-col gap-2 text-sm font-medium text-[#342A26]">
            <button
              onClick={() => {
                onScrollToShop();
                setMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#FCE9D8] transition"
            >
              Shop All Products
            </button>
            <button
              onClick={() => {
                onScrollToCategories();
                setMobileMenuOpen(false);
              }}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#FCE9D8] transition"
            >
              Shop by Category
            </button>
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="py-2 px-3 rounded-lg hover:bg-[#FCE9D8] transition"
            >
              Why NexaCart
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
