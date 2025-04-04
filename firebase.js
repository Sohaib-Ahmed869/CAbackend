const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

// Load service account properly
const serviceAccount = require("./serviceAccountKey2.json");

// Initialize Firebase Admin SDK
const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "gs://testca-e3e5e.firebasestorage.app",
});

// Initialize services
const db = getFirestore();
const auth = getAuth();
const bucket = getStorage().bucket();

module.exports = { db, auth, bucket };
