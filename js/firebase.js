// firebase.js
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAQD6y3lHaH_SMhrggFTK8z2tY8sIM_uzQ",
  authDomain: "bunk-smart.firebaseapp.com",
  projectId: "bunk-smart",
  storageBucket: "bunk-smart.firebasestorage.app",
  messagingSenderId: "442885510044",
  appId: "1:442885510044:web:dd98225defbe1de6e5ae59"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Set local persistence (persists across browser restarts)
import { setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js';
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error('Error setting persistence:', error);
});

// For backward compatibility with existing code
window.firebase = {
  auth: auth,
  firestore: db
};
