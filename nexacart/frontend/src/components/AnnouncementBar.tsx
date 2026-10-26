'use client';

import React, { useState } from 'react';

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <aside aria-label="Store announcement" className="bg-[#FCE9D8] text-[#342A26] text-xs font-medium border-b border-[#EDE3D9] px-4 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex-1 text-center flex items-center justify-center gap-2">
          <span className="text-sm">✨</span>
          <span>Discover your everyday favourites &bull; Thoughtfully curated essentials</span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-[#81736B] hover:text-[#342A26] p-0.5 rounded transition cursor-pointer"
          aria-label="Dismiss announcement"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
