import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyC42ixw1H_j4mdq4V3n_mXSeofPi_JUbWA",
  authDomain: "aestheticcustomizedchuri.firebaseapp.com",
  projectId: "aestheticcustomizedchuri",
  storageBucket: "aestheticcustomizedchuri.firebasestorage.app",
  messagingSenderId: "972899987852",
  appId: "1:972899987852:web:afc24a13ed6c87837166a9"
};

export const ADMIN_EMAILS = [
  "robiuletc@gmail.com",
  "mdmahbubsite@gmail.com"
];
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

// Initialize Firebase Client App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);

export const signInAdminWithEmail = async (email: string, pass: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return userCredential.user;
  } catch (error) {
    console.error("Firebase Email/Password Sign-In error:", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase Sign-Out error:", error);
  }
};

export const isAuthorizedAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((admin) => admin.toLowerCase() === normalized);
};

// --- DIRECT CLIENT-SIDE FIRESTORE OPERATIONS (Guarantees Vercel & Any Browser Works) ---

// 1. Fetch all products directly from Firestore
export const fetchProductsDirect = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 2. Fetch all categories directly from Firestore
export const fetchCategoriesDirect = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'categories'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 3. Fetch all orders directly from Firestore
export const fetchOrdersDirect = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'orders'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 4. Fetch all reviews directly from Firestore
export const fetchReviewsDirect = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'reviews'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 5. Fetch all messages directly from Firestore
export const fetchMessagesDirect = async (): Promise<any[]> => {
  const snap = await getDocs(collection(db, 'messages'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// 6. Fetch store settings directly from Firestore
export const fetchSettingsDirect = async (): Promise<any | null> => {
  const snap = await getDoc(doc(db, 'settings', 'store_settings'));
  return snap.exists() ? snap.data() : null;
};

// 7. Save / update single product directly in Firestore
export const saveProductDirect = async (product: any): Promise<void> => {
  if (!product || !product.id) return;
  await setDoc(doc(db, 'products', product.id), product, { merge: true });
};

// 8. Delete product directly from Firestore
export const deleteProductDirect = async (productId: string): Promise<void> => {
  if (!productId) return;
  await deleteDoc(doc(db, 'products', productId));
};

// 9. Save single order directly in Firestore
export const saveOrderDirect = async (order: any): Promise<void> => {
  if (!order || !order.id) return;
  await setDoc(doc(db, 'orders', order.id), order, { merge: true });
};

// 10. Save customer review directly in Firestore
export const saveReviewDirect = async (review: any): Promise<void> => {
  if (!review || !review.id) return;
  await setDoc(doc(db, 'reviews', review.id), review, { merge: true });
};

// 11. Save contact message directly in Firestore
export const saveMessageDirect = async (message: any): Promise<void> => {
  if (!message || !message.id) return;
  await setDoc(doc(db, 'messages', message.id), message, { merge: true });
};

// 12. Save store settings directly in Firestore
export const saveSettingsDirect = async (settings: any): Promise<void> => {
  await setDoc(doc(db, 'settings', 'store_settings'), settings, { merge: true });
};

// 13. Subscribe to real-time product updates (Any change in one browser syncs instantly to all browsers!)
export const subscribeToProductsRealtime = (callback: (products: any[]) => void): (() => void) => {
  return onSnapshot(
    collection(db, 'products'),
    (snap) => {
      const prods = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(prods);
    },
    (err) => {
      console.warn('Realtime products subscription notice:', err.message);
    }
  );
};
