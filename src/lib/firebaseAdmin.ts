// src/lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Ensure you have your Firebase Admin SDK credentials set up,
// typically via environment variables like GOOGLE_APPLICATION_CREDENTIALS
// or by explicitly initializing with service account details.
if (!admin.apps.length) {
  admin.initializeApp({
    // If using environment variables for default credentials, this might be enough.
    // Otherwise, provide credential details:
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}

export const firestore = admin.firestore();