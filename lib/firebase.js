// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCccztzhwABabRR58ku00vnoL-CKAOT0xY", // 🟢 paste from your console
  authDomain: "crossword-client.firebaseapp.com",
  databaseURL: "https://crossword-client-default-rtdb.firebaseio.com",
  projectId: "crossword-client",
  storageBucket: "crossword-client.appspot.com",
  messagingSenderId: "XXXXXXX",
  appId: "1:XXXXXXXX:web:XXXXXXXX"
};

// ✅ Initialize Firebase app
const app = initializeApp(firebaseConfig);

// ✅ Get Realtime Database
const db = getDatabase(app);

// ✅ Export db
export { db };
