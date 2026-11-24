
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { signOut, indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence, initializeAuth, getAuth, type Auth } from "firebase/auth";
import { enableMultiTabIndexedDbPersistence, initializeFirestore, getFirestore, type Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || "placeholder.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "placeholder-project",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || "placeholder.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || "1:000000000000:web:0000000000000000",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
// Use tiered persistence (IndexedDB -> LocalStorage -> Memory) for reliable iframe execution
let auth: Auth;
try {
  auth = typeof window !== 'undefined'
    ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence] })
    : getAuth(app);
} catch {
  auth = getAuth(app);
}
export { auth };

// Initialize Cloud Firestore with Long Polling enabled
// This is critical for campus networks that might block WebSockets/gRPC
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}
export { db };

// Enable Offline Persistence for Firestore
if (typeof window !== 'undefined') {
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled
            // in one tab at a a time.
            console.warn("Firestore persistence failed-precondition: multiple tabs open.");
        } else if (err.code == 'unimplemented') {
            // The current browser does not support all of the
            // features required to enable persistence
            console.warn("Firestore persistence unimplemented in this browser.");
        } else {
            console.error("Firestore persistence error:", err);
        }
    });
}

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Firebase Cloud Messaging and get a reference to the service
// Wrap in a try-catch for browsers/modes that don't support messaging
export const messaging = (typeof window !== 'undefined') ? (() => {
  try {
    // Only attempt if browser supports it
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      return getMessaging(app);
    }
    return null;
  } catch (e) {
    console.warn("Firebase Messaging is not supported in this browser environment.");
    return null;
  }
})() : null;

// Export a signOut function
export { signOut };
