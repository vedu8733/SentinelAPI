'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getHealth, getProducts, Product } from '../lib/api';
import { AnnouncementBar } from '../components/AnnouncementBar';
import { Navbar } from '../components/Navbar';
import { HeroSection } from '../components/HeroSection';
import { CategoryCards } from '../components/CategoryCards';
import { ProductCard } from '../components/ProductCard';
import { ProductDetailModal } from '../components/ProductDetailModal';
import { CartDrawer, CartItem } from '../components/CartDrawer';
import { CheckoutModal } from '../components/CheckoutModal';
import { ShoppingBenefits } from '../components/ShoppingBenefits';
import { Footer } from '../components/Footer';

export default function NexaCartHome() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cart & Modals
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState<Product | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'name-asc'>('featured');

  useEffect(() => {
    let isMounted = true;

    async function loadStore() {
      setIsLoading(true);
      setErrorMsg(null);

      // 1. Verify Store Backend Health (via SentinelAPI Gateway or direct fallback)
      try {
        await getHealth();
        if (isMounted) setIsBackendOnline(true);
      } catch (err: unknown) {
        if (isMounted) {
          setIsBackendOnline(false);
          setErrorMsg(
            'Unable to connect to NexaCart backend API on port 5001. Please verify that the store service is running.'
          );
        }
      }

      // 2. Fetch Catalogue Products
      try {
        const fetchedProducts = await getProducts();
        if (isMounted) setProducts(fetchedProducts);
      } catch (err: unknown) {
        if (isMounted && isBackendOnline !== false) {
          setErrorMsg((err as Error).message || 'Failed to retrieve product catalogue.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadStore();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cart Operations
  const addToCart = (product: Product, quantity: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.inventory) }
            : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.inventory) }];
    });
  };

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(newQuantity, item.product.inventory) }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleOrderCompleted = () => {
    setCart([]);
  };

  // Filter & Sort Logic
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category Filter
    if (selectedCategory) {
      result = result.filter(
        (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Search Term Filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'featured':
      default:
        // preserve backend ordering
        break;
    }

    return result;
  }, [products, selectedCategory, searchTerm, sortBy]);

  // Derived unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Scroll Helpers
  const scrollToShop = () => {
    const el = document.getElementById('catalogue');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToCategories = () => {
    const el = document.getElementById('categories');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF9F2] text-[#342A26]">
      {/* 1. Announcement Bar */}
      <AnnouncementBar />

      {/* 2. Navigation Header */}
      <Navbar
        cartCount={totalCartCount}
        onOpenCart={() => setIsCartOpen(true)}
        isBackendOnline={isBackendOnline}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onScrollToShop={scrollToShop}
        onScrollToCategories={scrollToCategories}
      />

      {/* 3. Main Content Container */}
      <main className="flex-1">
        {/* Backend Offline Notice (Polite & Reassuring) */}
        {isBackendOnline === false && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mt-6">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 shadow-2xs">
              <svg className="w-5 h-5 flex-shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <span className="font-bold block text-sm">Store API Offline</span>
                <p className="mt-0.5 leading-relaxed text-amber-800">
                  {errorMsg || 'Could not connect to http://127.0.0.1:5001/api/health. Please ensure the NexaCart backend service is running.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. Hero Section */}
        <HeroSection
          onExploreClick={scrollToShop}
          onCategoriesClick={scrollToCategories}
        />

        {/* 5. Shop by Category (Derived from real backend categories) */}
        <CategoryCards
          products={products}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            scrollToShop();
          }}
        />

        {/* 6. Product Catalogue & Listing */}
        <section id="catalogue" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 scroll-mt-20">
          {/* Header & Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-[#EDE3D9]">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-semibold bg-[#FCE9D8] text-[#D96C4F] mb-1.5">
                Everyday Essentials
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#342A26]">
                Our Product Catalogue
              </h2>
              <p className="text-xs sm:text-sm text-[#81736B] mt-1">
                Thoughtfully selected tech gear ready for safe, simulated ordering.
              </p>
            </div>

            {/* Filter Pills & Sort Dropdown */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-white border border-[#EDE3D9] text-xs">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                    selectedCategory === null
                      ? 'bg-[#D96C4F] text-white shadow-2xs'
                      : 'text-[#81736B] hover:text-[#342A26]'
                  }`}
                >
                  All ({products.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full font-semibold transition cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#D96C4F] text-white shadow-2xs'
                        : 'text-[#81736B] hover:text-[#342A26]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Sort Control */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  aria-label="Sort products"
                  className="px-3.5 py-2 rounded-full bg-white border border-[#EDE3D9] text-xs font-semibold text-[#342A26] focus:outline-none focus:ring-2 focus:ring-[#D96C4F]/30 cursor-pointer shadow-2xs pr-8 appearance-none"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="price-asc">Price: Low to High</option>
                  <option value="price-desc">Price: High to Low</option>
                  <option value="name-asc">Name: A to Z</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#81736B]">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Active Filter Notice */}
          {(selectedCategory || searchTerm) && (
            <div className="flex items-center justify-between py-3 border-b border-[#EDE3D9] text-xs text-[#81736B]">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Active filters:</span>
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FCE9D8] text-[#D96C4F] font-semibold text-[11px]">
                    Category: {selectedCategory}
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className="hover:text-black ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                )}
                {searchTerm && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FCE9D8] text-[#D96C4F] font-semibold text-[11px]">
                    Search: &ldquo;{searchTerm}&rdquo;
                    <button
                      onClick={() => setSearchTerm('')}
                      className="hover:text-black ml-0.5"
                    >
                      &times;
                    </button>
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSearchTerm('');
                  setSortBy('featured');
                }}
                className="text-[#D96C4F] hover:underline font-semibold"
              >
                Reset All Filters
              </button>
            </div>
          )}

          {/* Product Grid / States */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="rounded-2xl bg-white border border-[#EDE3D9] p-5 space-y-4 animate-pulse shadow-2xs"
                >
                  <div className="aspect-square w-full rounded-xl bg-[#FCE9D8]/50" />
                  <div className="h-4 bg-[#EDE3D9] rounded w-3/4" />
                  <div className="h-3 bg-[#EDE3D9]/60 rounded w-full" />
                  <div className="h-3 bg-[#EDE3D9]/60 rounded w-2/3" />
                  <div className="pt-4 flex justify-between items-center">
                    <div className="h-5 bg-[#EDE3D9] rounded w-16" />
                    <div className="h-8 bg-[#EDE3D9] rounded-full w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-[#FCE9D8] flex items-center justify-center text-[#D96C4F] mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-[#342A26]">No products matched your criteria</h3>
              <p className="text-xs text-[#81736B] max-w-sm mx-auto">
                Try clearing your search term or selecting a different category from our essentials.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setSearchTerm('');
                }}
                className="px-5 py-2.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] text-white text-xs font-semibold transition cursor-pointer"
              >
                View All Products
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-8">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(p) => addToCart(p, 1)}
                  onViewDetails={(p) => setSelectedProductForDetail(p)}
                />
              ))}
            </div>
          )}
        </section>

        {/* 7. Friendly Shopping Benefits (Verified claims) */}
        <ShoppingBenefits />
      </main>

      {/* 8. Footer */}
      <Footer
        onScrollToShop={scrollToShop}
        onScrollToCategories={scrollToCategories}
      />

      {/* 9. Product Details Modal */}
      <ProductDetailModal
        product={selectedProductForDetail}
        onClose={() => setSelectedProductForDetail(null)}
        onAddToCart={(p, qty) => addToCart(p, qty)}
      />

      {/* 10. Shopping Cart Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeFromCart}
        onProceedToCheckout={() => {
          setIsCartOpen(false);
          setIsCheckoutOpen(true);
        }}
      />

      {/* 11. Simulated Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        onOrderCompleted={handleOrderCompleted}
      />
    </div>
  );
}
