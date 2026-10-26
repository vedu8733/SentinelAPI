'use client';

import React from 'react';

export function ShoppingBenefits() {
  const benefits = [
    {
      title: 'Protected Checkout',
      desc: 'All store requests and transactions are safeguarded by intelligent perimeter gateway security.',
      icon: (
        <svg className="w-5 h-5 text-[#D96C4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      title: 'Live Inventory Sync',
      desc: 'Transparent stock counts updated directly from our store database in real time.',
      icon: (
        <svg className="w-5 h-5 text-[#D96C4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      title: 'Simpler Everyday Shopping',
      desc: 'A friendly, welcoming storefront designed to make discovering everyday essentials intuitive.',
      icon: (
        <svg className="w-5 h-5 text-[#D96C4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
    {
      title: 'Customer-First Support',
      desc: 'Transparent product details, clear specifications, and helpful assistance whenever needed.',
      icon: (
        <svg className="w-5 h-5 text-[#D96C4F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
  ];

  return (
    <section id="benefits" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-b border-[#EDE3D9]">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#D96C4F] bg-[#FCE9D8] px-3 py-1 rounded-full">
          Why Shop NexaCart
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#342A26] mt-3">
          Thoughtful shopping, made simple.
        </h2>
        <p className="text-xs sm:text-sm text-[#81736B] mt-1.5">
          Everything you need for an easy, confident online shopping experience.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {benefits.map((b, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white border border-[#EDE3D9] p-5 sm:p-6 shadow-2xs hover:shadow-sm hover:border-[#D96C4F]/40 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-xl bg-[#FCE9D8] flex items-center justify-center">
                {b.icon}
              </div>
              <h3 className="text-sm font-bold text-[#342A26]">{b.title}</h3>
              <p className="text-xs text-[#81736B] leading-relaxed">{b.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
