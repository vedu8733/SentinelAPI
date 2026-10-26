import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';

export const productsRouter = Router();

// Fallback seed products if database is empty
const DEMO_PRODUCTS = [
  {
    id: 'prod-1',
    name: 'Quantum Sound Wireless Headphones',
    slug: 'quantum-sound-wireless-headphones',
    description: 'Active noise cancellation with 40-hour battery life and studio-grade acoustics.',
    price: 149.99,
    inventory: 50,
    category: 'Audio',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&auto=format&fit=crop&q=60',
    isActive: true
  },
  {
    id: 'prod-2',
    name: 'AeroGlide Mechanical Gaming Keyboard',
    slug: 'aeroglide-mechanical-gaming-keyboard',
    description: 'Hot-swappable tactile switches with customizable per-key RGB backlighting.',
    price: 89.99,
    inventory: 35,
    category: 'Gaming',
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&auto=format&fit=crop&q=60',
    isActive: true
  },
  {
    id: 'prod-3',
    name: 'TitanShield Smart Fitness Watch',
    slug: 'titanshield-smart-fitness-watch',
    description: 'Continuous biometric tracking, sapphire glass display, and waterproof to 50m.',
    price: 199.99,
    inventory: 20,
    category: 'Wearables',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60',
    isActive: true
  },
  {
    id: 'prod-4',
    name: 'Vortex Pro Ergonomic Wireless Mouse',
    slug: 'vortex-pro-ergonomic-wireless-mouse',
    description: 'High-precision 16,000 DPI optical sensor with contoured thumb rest.',
    price: 59.99,
    inventory: 60,
    category: 'Accessories',
    imageUrl: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&auto=format&fit=crop&q=60',
    isActive: true
  }
];

productsRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    let products: any[] = [];
    try {
      products = await prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch {
      // Fallback to static demo products if DB is not seeded yet
      products = DEMO_PRODUCTS;
    }

    if (!products || products.length === 0) {
      products = DEMO_PRODUCTS;
    }

    res.status(200).json({
      products,
      total: products.length
    });
  } catch (err) {
    next(err);
  }
});

productsRouter.get('/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = String(req.params.slug);
    let product: any = null;

    try {
      product = await prisma.product.findUnique({
        where: { slug }
      });
    } catch {
      product = DEMO_PRODUCTS.find((p) => p.slug === slug) || null;
    }

    if (!product) {
      product = DEMO_PRODUCTS.find((p) => p.slug === slug) || null;
    }

    if (!product) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: `Product with slug "${slug}" was not found.`
        }
      });
      return;
    }

    res.status(200).json({ product });
  } catch (err) {
    next(err);
  }
});
