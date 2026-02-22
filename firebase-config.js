// ============================================================
//  firebase-config.js  — Single source of truth for Firebase
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBqXCIADKkXdP8Wlq0KxThoo_8csZGsKnc",
    authDomain: "crgv10.firebaseapp.com",
    projectId: "crgv10",
    storageBucket: "crgv10.firebasestorage.app",
    messagingSenderId: "574552305101",
    appId: "1:574552305101:web:7643401e84d9ff5c0fa884",
    measurementId: "G-N5M25BHT1R"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
