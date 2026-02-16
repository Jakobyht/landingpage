import { auth, db, onAuthStateChanged } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

/**
 * Redirect to login if user is not authenticated.
 * Returns a promise that resolves with the user object.
 */
export function requireAuth() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.href = "index.html";
      } else {
        resolve(user);
      }
    });
  });
}

/**
 * Check if user has completed their knowledge base.
 * If not, redirect to knowledge-base.html.
 * Call this AFTER requireAuth().
 */
export async function requireKnowledgeBase(user) {
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (!userDoc.exists() || !userDoc.data().knowledgeBase?.completedAt) {
    window.location.href = "knowledge-base.html";
    return false;
  }
  return true;
}

/**
 * Redirect to dashboard if user is already authenticated.
 */
export function redirectIfLoggedIn() {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        window.location.href = "dashboard.html";
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get project ID from URL params.
 */
export function getProjectId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}
