// firebase.js
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const serviceAccount = "./serviceAccountKey.json";

const firebaseApp = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: "gs://certifiedaustralia1.appspot.com",
});

const db = getFirestore(firebaseApp);

const auth = getAuth(firebaseApp);

const bucket = getStorage().bucket();
module.exports = { db, auth, bucket };
