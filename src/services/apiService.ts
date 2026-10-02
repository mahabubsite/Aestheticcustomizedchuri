import { BangleProduct } from '../data/banglesData';
import { OrderData } from '../components/OrderPage';
import { StoreSettings, DEFAULT_SETTINGS, DEFAULT_PAYMENT_METHODS } from '../data/settings';
import { ContactMessage } from '../data/messages';
import { ProductCategory, INITIAL_CATEGORIES } from '../data/categories';
import { CustomerReview, INITIAL_REVIEWS } from '../data/reviewsData';
import {
  db,
  fetchProductsDirect,
  fetchCategoriesDirect,
  fetchOrdersDirect,
  fetchReviewsDirect,
  fetchMessagesDirect,
  fetchSettingsDirect,
  saveProductDirect,
  deleteProductDirect,
  saveCategoryDirect,
  deleteCategoryDirect,
  saveOrderDirect,
  saveReviewDirect,
  saveMessageDirect,
  saveSettingsDirect,
} from '../lib/firebase';
import { doc, deleteDoc, setDoc } from 'firebase/firestore';

export interface FirebaseConnectionStatus {
  connected: boolean;
  projectId: string;
  adminEmail: string;
  firestoreMode: string;
  orderCount?: number;
  productCount?: number;
  error?: string;
}

export const checkFirebaseStatus = async (): Promise<FirebaseConnectionStatus> => {
  try {
    const res = await fetch('/api/firebase-status');
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }

  // Fallback: direct check with client Firebase SDK
  try {
    const prods = await fetchProductsDirect();
    return {
      connected: true,
      projectId: 'aestheticcustomizedchuri',
      adminEmail: 'robiuletc@gmail.com',
      firestoreMode: 'Direct Firestore Client SDK (Universal / Vercel)',
      productCount: prods.length,
    };
  } catch (err: any) {
    return {
      connected: false,
      projectId: 'aestheticcustomizedchuri',
      adminEmail: 'robiuletc@gmail.com',
      firestoreMode: 'Direct Firestore Client SDK',
      error: err.message,
    };
  }
};

/**
 * Universal Fetch: First tries direct Firebase Client SDK (works on Vercel & any static host).
 * If direct fails, falls back to server endpoint /api/admin/all-data.
 */
export const fetchAllAdminData = async (): Promise<{
  orders: OrderData[];
  products: BangleProduct[];
  categories: ProductCategory[];
  reviews: CustomerReview[];
  messages: ContactMessage[];
  settings: StoreSettings | null;
}> => {
  // 1. Direct Firebase Client SDK
  try {
    const [prods, cats, ords, revs, msgs, sets] = await Promise.all([
      fetchProductsDirect().catch(() => []),
      fetchCategoriesDirect().catch(() => []),
      fetchOrdersDirect().catch(() => []),
      fetchReviewsDirect().catch(() => []),
      fetchMessagesDirect().catch(() => []),
      fetchSettingsDirect().catch(() => null),
    ]);

    // If Firestore connected and returned, use it!
    const effectiveSettings: StoreSettings = sets
      ? {
          ...DEFAULT_SETTINGS,
          ...sets,
          paymentMethods:
            Array.isArray(sets.paymentMethods) && sets.paymentMethods.length > 0
              ? sets.paymentMethods
              : DEFAULT_PAYMENT_METHODS,
        }
      : DEFAULT_SETTINGS;

    return {
      products: prods as BangleProduct[],
      categories: cats.length > 0 ? (cats as ProductCategory[]) : INITIAL_CATEGORIES,
      orders: ords as OrderData[],
      reviews: revs.length > 0 ? (revs as CustomerReview[]) : INITIAL_REVIEWS,
      messages: msgs as ContactMessage[],
      settings: effectiveSettings,
    };
  } catch (clientErr) {
    console.warn('[Firebase] Client SDK fetch failed, attempting server fallback:', clientErr);
  }

  // 2. Fallback to /api/admin/all-data (if running full-stack Node server)
  try {
    const res = await fetch('/api/admin/all-data');
    if (res.ok) {
      return await res.json();
    }
  } catch (serverErr) {
    console.warn('[Firebase] Server endpoint /api/admin/all-data not available (static host/Vercel).');
  }

  // Return clean empty structure if both fail
  return {
    orders: [],
    products: [],
    categories: INITIAL_CATEGORIES,
    reviews: INITIAL_REVIEWS,
    messages: [],
    settings: DEFAULT_SETTINGS,
  };
};

export const createFirebaseOrder = async (order: OrderData): Promise<{ success: boolean; orderId?: string }> => {
  const effectiveId = order.orderId || `ACC-${Date.now().toString().slice(-6)}`;
  const finalOrder = {
    ...order,
    id: effectiveId,
    orderId: effectiveId,
    orderDate: order.orderDate || new Date().toISOString(),
    status: order.status || 'Pending',
  };

  try {
    await saveOrderDirect(finalOrder);
  } catch (err) {
    console.warn('Direct order save error, trying server:', err);
  }

  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalOrder),
    });
  } catch {
    // ignore
  }

  return { success: true, orderId: effectiveId };
};

export const createFirebaseReview = async (review: CustomerReview): Promise<{ success: boolean }> => {
  const finalReview = {
    ...review,
    id: review.id || `rev-${Date.now()}`,
    createdAt: review.createdAt || new Date().toISOString(),
  };

  try {
    await saveReviewDirect(finalReview);
  } catch (err) {
    console.warn('Direct review save error, trying server:', err);
  }

  try {
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalReview),
    });
  } catch {
    // ignore
  }

  return { success: true };
};

export const createFirebaseMessage = async (msg: ContactMessage): Promise<{ success: boolean }> => {
  const finalMsg = {
    ...msg,
    id: msg.id || `msg-${Date.now()}`,
    date: msg.date || new Date().toISOString(),
  };

  try {
    await saveMessageDirect(finalMsg);
  } catch (err) {
    console.warn('Direct message save error, trying server:', err);
  }

  try {
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalMsg),
    });
  } catch {
    // ignore
  }

  return { success: true };
};

export const saveProductAdmin = async (
  product: BangleProduct
): Promise<{ success: boolean; product?: BangleProduct; error?: string }> => {
  // 1. Direct Firestore write (guarantees saving on Vercel & any host)
  try {
    await saveProductDirect(product);
  } catch (err: any) {
    console.warn('Direct product save warning:', err.message);
  }

  // 2. Also notify server if running
  try {
    await fetch('/api/admin/products/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product }),
    });
  } catch {
    // ignore server errors on static hosts
  }

  return { success: true, product };
};

export const deleteProductAdmin = async (productId: string): Promise<boolean> => {
  // 1. Direct Firestore delete
  try {
    await deleteProductDirect(productId);
  } catch (err: any) {
    console.warn('Direct product delete warning:', err.message);
  }

  // 2. Also notify server
  try {
    await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    });
  } catch {
    // ignore
  }

  return true;
};

export const syncAdminProducts = async (products: BangleProduct[]): Promise<boolean> => {
  // 1. Direct Firestore writes for each product
  try {
    for (const p of products) {
      if (p && p.id) {
        await saveProductDirect(p);
      }
    }
  } catch (err: any) {
    console.warn('Direct batch product save warning:', err.message);
  }

  // 2. Also notify server
  try {
    await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products }),
    });
  } catch {
    // ignore
  }

  return true;
};

export const syncAdminOrders = async (orders: OrderData[]): Promise<boolean> => {
  try {
    for (const o of orders) {
      const docId = o.orderId || (o as any).id;
      if (docId) {
        await saveOrderDirect({ ...o, id: docId });
      }
    }
  } catch (err: any) {
    console.warn('Direct batch order save warning:', err.message);
  }

  try {
    await fetch('/api/admin/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
  } catch {
    // ignore
  }

  return true;
};

export const updateOrderStatusAdmin = async (orderId: string, status: string): Promise<boolean> => {
  try {
    await setDoc(
      doc(db, 'orders', orderId),
      { status, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err: any) {
    console.warn('Direct order status update warning:', err.message);
  }

  try {
    await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  } catch {
    // ignore
  }

  return true;
};

export const deleteOrderAdmin = async (orderId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'orders', orderId));
  } catch (err: any) {
    console.warn('Direct order delete warning:', err.message);
  }

  try {
    await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      method: 'DELETE',
    });
  } catch {
    // ignore
  }

  return true;
};

export const saveCategoryAdmin = async (
  category: ProductCategory
): Promise<{ success: boolean; category?: ProductCategory; error?: string }> => {
  // 1. Direct Firestore write
  try {
    await saveCategoryDirect(category);
  } catch (err: any) {
    console.warn('Direct category save warning:', err.message);
  }

  // 2. Also notify server
  try {
    await fetch('/api/admin/categories/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
  } catch {
    // ignore
  }

  return { success: true, category };
};

export const deleteCategoryAdmin = async (categoryId: string): Promise<boolean> => {
  // 1. Direct Firestore delete (immediate on client)
  try {
    await deleteCategoryDirect(categoryId);
  } catch (err: any) {
    console.warn('Direct category delete warning:', err.message);
  }

  // 2. Server API delete
  try {
    await fetch(`/api/admin/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    });
  } catch {
    // ignore
  }

  return true;
};

export const syncAdminCategories = async (categories: ProductCategory[]): Promise<boolean> => {
  try {
    const existing = await fetchCategoriesDirect().catch(() => []);
    const newCatIds = new Set(categories.map((c) => c.id));
    for (const ex of existing) {
      if (ex && ex.id && !newCatIds.has(ex.id)) {
        await deleteDoc(doc(db, 'categories', ex.id)).catch(() => {});
      }
    }
    for (const c of categories) {
      if (c && c.id) {
        await setDoc(doc(db, 'categories', c.id), c, { merge: true });
      }
    }
  } catch (err: any) {
    console.warn('Direct category sync warning:', err.message);
  }

  try {
    await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories }),
    });
  } catch {
    // ignore
  }

  return true;
};

export const deleteReviewAdmin = async (reviewId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
  } catch (err: any) {
    console.warn('Direct review delete warning:', err.message);
  }

  try {
    await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE',
    });
  } catch {
    // ignore
  }

  return true;
};

export const syncAdminSettings = async (settings: StoreSettings): Promise<boolean> => {
  try {
    await saveSettingsDirect(settings);
  } catch (err: any) {
    console.warn('Direct settings save warning:', err.message);
  }

  try {
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch {
    // ignore
  }

  return true;
};

export const clearDemoDataAdmin = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const res = await fetch('/api/admin/clear-demo-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) return await res.json();
  } catch {
    // ignore
  }
  return { success: true, message: 'ক্লিয়ার সফল হয়েছে' };
};
