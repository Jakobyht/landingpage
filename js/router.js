import { auth, db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";

/**
 * Wait for Firebase auth to fully initialize, then redirect to login
 * if the user is not authenticated. Returns a promise with the user.
 */
export async function requireAuth() {
  await auth.authStateReady(); // Waits until Firebase has loaded auth from storage
  if (!auth.currentUser) {
    window.location.href = "index.html";
    return null;
  }
  return auth.currentUser;
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
export async function redirectIfLoggedIn() {
  await auth.authStateReady();
  if (auth.currentUser) {
    window.location.href = "dashboard.html";
  }
}

/**
 * Get project ID from URL params. 
 * Fallback to sessionStorage to handle aggressive 301 redirects that strip query params.
 */
export function getProjectId() {
  const params = new URLSearchParams(window.location.search);
  const idFromUrl = params.get("id");

  if (idFromUrl) {
    sessionStorage.setItem("currentProjectId", idFromUrl);
    return idFromUrl;
  }

  return sessionStorage.getItem("currentProjectId");
}
