export const API_BASE_URL =
  process.env.NEXT_PUBLIC_NEXACART_API_URL || 'http://127.0.0.1:4000/api/gateway/nexacart';

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  inventory: number;
  category: string;
  imageUrl?: string;
  isActive: boolean;
}

export interface HealthResponse {
  status: string;
  service: string;
  database: string;
  timestamp: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE_URL}/api/health`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`);
  }
  return res.json();
}

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE_URL}/api/products`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    throw new Error(`Failed to load products (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.products || [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(slug)}`, {
    cache: 'no-store'
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to load product details (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.product || null;
}
