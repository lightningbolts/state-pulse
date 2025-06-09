
import { initializeApp, getApps, getApp, type FirebaseOptions, FirebaseApp} from "firebase/app";
import {getFirestore} from "firebase/firestore";
import {getAnalytics, isSupported} from "firebase/analytics";
// import { getAuth } from "firebase/auth"; // Example if you need Auth
// import { getStorage } from "firebase/storage"; // Example if you need Storage

// Your web app's Firebase configuration is read from environment variables
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
let app: FirebaseApp | undefined;
let analytics;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  if (typeof window !== 'undefined') {
    // Initialize Analytics only on the client side and if supported
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  }
} else {
  app = getApp(); // If already initialized, use that instance
  if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
      if (supported) {
        try {
          // It's good practice to get analytics instance only if already initialized
          // or initialize if not. getAnalytics handles this.
          analytics = getAnalytics(app);
        } catch (e) {
          console.warn("Firebase Analytics initialization failed or already initialized elsewhere:", e);
        }
      }
    });
  }
}

const db = getFirestore(app);
// const auth = getAuth(app); // Example if you need Auth
// const storage = getStorage(app); // Example if you need Storage

export { db, app, analytics /*, auth, storage */ }; // Export db, app, analytics and other services you might use
