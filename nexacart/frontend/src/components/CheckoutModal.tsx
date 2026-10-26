'use client';

import React, { useState } from 'react';
import { CartItem } from './CartDrawer';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onOrderCompleted: () => void;
}

export function CheckoutModal({
  isOpen,
  onClose,
  cart,
  onOrderCompleted,
}: CheckoutModalProps) {
  const [customerName, setCustomerName] = useState('Alex Mercer');
  const [customerEmail, setCustomerEmail] = useState('alex@example.com');
  const [shippingAddress, setShippingAddress] = useState('123 Innovation Way, Suite 400');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);

  if (!isOpen) return null;

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate backend order creation
    setTimeout(() => {
      const orderId = `NX-${Math.floor(100000 + Math.random() * 900000)}`;
      setCompletedOrderId(orderId);
      setIsSubmitting(false);
      onOrderCompleted();
    }, 800);
  };

  const handleFinish = () => {
    setCompletedOrderId(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#342A26]/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={completedOrderId ? handleFinish : onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white border border-[#EDE3D9] p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {completedOrderId ? (
          /* Order Confirmation View */
          <div className="text-center py-6 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#A8B89A]/20 text-[#A8B89A]">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div className="space-y-1">
              <span className="text-xs uppercase font-bold tracking-wider text-[#A8B89A]">
                Order Confirmed
              </span>
              <h2 id="checkout-modal-title" className="text-2xl font-extrabold text-[#342A26]">
                Thank you for your order!
              </h2>
              <p className="text-xs text-[#81736B] max-w-sm mx-auto">
                Your simulated purchase has been recorded. In future phases, orders will be cryptographically signed via SentinelAPI HMAC gateway.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#EDE3D9] text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#81736B]">Order Reference:</span>
                <span className="font-mono font-bold text-[#342A26]">{completedOrderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#81736B]">Customer:</span>
                <span className="font-medium text-[#342A26]">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#81736B]">Total Paid:</span>
                <span className="font-bold text-[#D96C4F]">${cartSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#81736B]">Status:</span>
                <span className="text-[#A8B89A] font-semibold">Simulated &bull; Verified</span>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3.5 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] text-white font-semibold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer"
            >
              Back to Storefront
            </button>
          </div>
        ) : (
          /* Checkout Form View */
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#EDE3D9]">
              <div>
                <h2 id="checkout-modal-title" className="text-lg font-bold text-[#342A26]">
                  Simulated Checkout
                </h2>
                <p className="text-xs text-[#81736B]">
                  Safe demonstration checkout &bull; No real cards charged
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[#FCE9D8] text-[#81736B] hover:text-[#342A26] transition cursor-pointer"
                aria-label="Close checkout"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Order Items Preview */}
            <div className="p-4 rounded-2xl bg-[#FFF9F2] border border-[#EDE3D9] space-y-2 text-xs">
              <span className="text-[11px] font-bold text-[#81736B] uppercase tracking-wider block">
                Order Items ({cart.length})
              </span>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {cart.map(({ product, quantity }) => (
                  <div key={product.id} className="flex justify-between items-center text-xs">
                    <span className="text-[#342A26] truncate max-w-[240px]">
                      {product.name} &times; {quantity}
                    </span>
                    <span className="font-semibold text-[#342A26]">
                      ${(product.price * quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t border-[#EDE3D9] flex justify-between font-bold text-sm text-[#342A26]">
                <span>Total Amount</span>
                <span className="text-[#D96C4F]">${cartSubtotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Simulated Checkout Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#342A26] mb-1" htmlFor="checkout-name">
                    Full Name
                  </label>
                  <input
                    id="checkout-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EDE3D9] text-xs text-[#342A26] focus:outline-none focus:ring-2 focus:ring-[#D96C4F]/30 focus:border-[#D96C4F] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#342A26] mb-1" htmlFor="checkout-email">
                    Email Address
                  </label>
                  <input
                    id="checkout-email"
                    type="email"
                    required
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EDE3D9] text-xs text-[#342A26] focus:outline-none focus:ring-2 focus:ring-[#D96C4F]/30 focus:border-[#D96C4F] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#342A26] mb-1" htmlFor="checkout-address">
                    Delivery Address
                  </label>
                  <input
                    id="checkout-address"
                    type="text"
                    required
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#EDE3D9] text-xs text-[#342A26] focus:outline-none focus:ring-2 focus:ring-[#D96C4F]/30 focus:border-[#D96C4F] transition"
                  />
                </div>
              </div>

              {/* Security Boundary Notice */}
              <div className="p-3.5 rounded-xl bg-[#FCE9D8]/50 border border-[#EDE3D9] text-[11px] text-[#81736B] leading-relaxed flex items-start gap-2.5">
                <span className="text-sm">🛡️</span>
                <span>
                  <strong>Safety Demonstration:</strong> Zero credit card or billing details are collected. All requests are monitored by SentinelAPI gateway for unauthorized tampering.
                </span>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-full bg-white hover:bg-[#FCE9D8] text-[#342A26] border border-[#EDE3D9] text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-full bg-[#D96C4F] hover:bg-[#C85B3E] active:scale-98 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Place Order &bull; ${cartSubtotal.toFixed(2)}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
