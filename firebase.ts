import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Configuration provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyCkZ9qcSnC4QqqC_1xydGq1yoNF5WcB3wo",
  authDomain: "temperatureprofile-80dd0.firebaseapp.com",
  projectId: "temperatureprofile-80dd0",
  storageBucket: "temperatureprofile-80dd0.firebasestorage.app",
  messagingSenderId: "100923735054",
  appId: "1:100923735054:web:5e57aef94e5cbff2ba105f",
  measurementId: "G-6Q29ZXRGMJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);