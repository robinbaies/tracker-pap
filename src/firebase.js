import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDu-JB6bM8sCD6I3Ht21HikbfkVifShkRs",
  authDomain: "tracker-pap.firebaseapp.com",
  projectId: "tracker-pap",
  storageBucket: "tracker-pap.firebasestorage.app",
  messagingSenderId: "391977552313",
  appId: "1:391977552313:web:384b989503e09723a64e68"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
