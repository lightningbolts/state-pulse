
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// import { getAuth } from "firebase/auth"; // Example if you need Auth
// import { getStorage } from "firebase/storage"; // Example if you need Storage

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBCqXEzN3Hp6AoU-dhOPto2V0GTRPk_I_s",
  authDomain: "statepulse.firebaseapp.com",
  projectId: "statepulse",
  storageBucket: "statepulse.firebasestorage.app",
  messagingSenderId: "681550391766",
  appId: "1:681550391766:web:4a30448d581a9ae432dc77",
  measurementId: "G-HFBQPDBEJN"
};

// Initialize Firebase
let app;
let analytics;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  if (typeof window !== 'undefined') {
    // Initialize Analytics only on the client side
    analytics = getAnalytics(app);
  }
} else {
  app = getApp(); // If already initialized, use that instance
  if (typeof window !== 'undefined') {
    // Ensure analytics is initialized if app was already created
    // This might be redundant if getAnalytics is idempotent or if app is always initialized once.
    // However, better to be safe or rely on getAnalytics to handle multiple calls gracefully.
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      // Analytics might have been initialized by another part of the app
      // or if getAnalytics isn't perfectly idempotent for some reason.
      console.warn("Firebase Analytics might already be initialized or failed to initialize:", e);
    }
  }
}

const db = getFirestore(app);
// const auth = getAuth(app); // Example if you need Auth
// const storage = getStorage(app); // Example if you need Storage

export { db, app, analytics /*, auth, storage */ }; // Export db, app, analytics and other services you might use
