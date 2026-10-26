'use client';

import React from 'react';
import Link from 'next/link';

interface FooterProps {
  onScrollToShop: () => void;
  onScrollToCategories: () => void;
}

export function Footer({ onScrollToShop, onScrollToCategories }: FooterProps) {
  return (
    <footer className="bg-[#FDF4EB] border-t border-[#EDE3D9] text-[#342A26]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#D96C4F] text-white">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <span className="text-lg font-bold tracking-tight text-[#342A26]">
                Nexa<span className="text-[#D96C4F]">Cart</span>
              </span>
            </div>
            <p className="text-xs text-[#81736B] leading-relaxed">
              Find little things that make everyday life better. Thoughtfully curated tech essentials and everyday gear with direct inventory tracking.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-[#A8B89A]/20 text-[#342A26] border border-[#A8B89A]/30">
              <span className="h-1.5 w-1.5 rounded-full bg-[#A8B89A]" />
              Guarded by SentinelAPI Gateway
            </div>
          </div>

          {/* Quick Shop Links */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#342A26]">
              Shop Essentials
            </h3>
            <ul className="space-y-2 text-xs text-[#81736B]">
              <li>
                <button
                  onClick={onScrollToShop}
                  className="hover:text-[#D96C4F] transition cursor-pointer"
                >
                  All Products
                </button>
              </li>
              <li>
                <button
                  onClick={onScrollToCategories}
                  className="hover:text-[#D96C4F] transition cursor-pointer"
                >
                  Shop by Category
                </button>
              </li>
              <li>
                <a href="#benefits" className="hover:text-[#D96C4F] transition">
                  Store Benefits
                </a>
              </li>
            </ul>
          </div>

          {/* Policies & Reassurance */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#342A26]">
              Store Policies
            </h3>
            <ul className="space-y-2 text-xs text-[#81736B]">
              <li>
                <span className="hover:text-[#342A26] transition">Safe Simulated Commerce</span>
              </li>
              <li>
                <span className="hover:text-[#342A26] transition">Zero Credit Card Storage</span>
              </li>
              <li>
                <span className="hover:text-[#342A26] transition">Cryptographic HMAC Integrity</span>
              </li>
              <li>
                <span className="hover:text-[#342A26] transition">Direct Port 5001 Isolation</span>
              </li>
            </ul>
          </div>

          {/* Customer & Technical Support */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#342A26]">
              Customer Care
            </h3>
            <p className="text-xs text-[#81736B] leading-relaxed">
              NexaCart is an authentic e-commerce storefront operating on port 3001, providing live inventory and demonstration transactions.
            </p>
            <div className="text-xs text-[#342A26] font-medium pt-1">
              Store API Status: <span className="text-[#A8B89A]">Operational</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-6 border-t border-[#EDE3D9] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#81736B]">
          <p>
            &copy; {new Date().getFullYear()} NexaCart Store. All rights reserved. Safeguarded by SentinelAPI.
          </p>
          <div className="flex items-center gap-4">
            <span className="hover:text-[#342A26]">Privacy Policy</span>
            <span>&bull;</span>
            <span className="hover:text-[#342A26]">Terms of Service</span>
            <span>&bull;</span>
            <span className="hover:text-[#342A26]">Demo Store</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
