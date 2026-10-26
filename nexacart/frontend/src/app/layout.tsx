import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexaCart — Everyday Essentials & Smart Goods',
  description: 'Discover your everyday favourites. Thoughtfully curated tech essentials and everyday goods with seamless shopping.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-[#FFF9F2] text-[#342A26] min-h-screen antialiased selection:bg-[#FCE9D8] selection:text-[#D96C4F]">
        {children}
      </body>
    </html>
  );
}
