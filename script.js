import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBVTxlZQxLL5SLWqKYpzv0HXd-6wByCAOQ",
  authDomain: "kai-ke-fit-dashboard.firebaseapp.com",
  projectId: "kai-ke-fit-dashboard",
  storageBucket: "kai-ke-fit-dashboard.firebasestorage.app",
  messagingSenderId: "585365049265",
  appId: "1:585365049265:web:6b4c7468627d0dba94b790",
  measurementId: "G-T5E7VSDKN3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const usersCollection = collection(db, "users");
const checkinsCollection = collection(db, "checkins");

let users = [];
let checkins = [];

window.users = users;
window.checkins = checkins;

console.log("Firebase Connected");