import { initializeApp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC6kFwkJx7au1gnmIZhrYRJB735cz_7gTI",
  authDomain: "cvautomation-fb2e9.firebaseapp.com",
  projectId: "cvautomation-fb2e9",
  storageBucket: "cvautomation-fb2e9.firebasestorage.app",
  messagingSenderId: "418900211575",
  appId: "1:418900211575:web:11b02f2eff060f47971372",
  measurementId: "G-RJVKMXJPRW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, onAuthStateChanged };
