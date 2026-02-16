import { auth } from "./firebase-config.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { redirectIfLoggedIn } from "./router.js";

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const toggleLink = document.getElementById("toggle-link");
const toggleText = document.getElementById("toggle-text");
const errorEl = document.getElementById("error");

let isLogin = true;

// Redirect if already logged in
redirectIfLoggedIn();

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add("visible");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.remove("visible");
}

toggleLink.addEventListener("click", (e) => {
  e.preventDefault();
  clearError();
  isLogin = !isLogin;
  if (isLogin) {
    loginForm.style.display = "";
    signupForm.style.display = "none";
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = "Sign up";
  } else {
    loginForm.style.display = "none";
    signupForm.style.display = "";
    toggleText.textContent = "Already have an account?";
    toggleLink.textContent = "Log in";
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.location.href = "dashboard.html";
  } catch (err) {
    showError(friendlyError(err.code));
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-password-confirm").value;

  if (password !== confirm) {
    showError("Passwords do not match.");
    return;
  }

  try {
    await createUserWithEmailAndPassword(auth, email, password);
    window.location.href = "knowledge-base.html";
  } catch (err) {
    showError(friendlyError(err.code));
  }
});

function friendlyError(code) {
  switch (code) {
    case "auth/email-already-in-use": return "This email is already registered.";
    case "auth/invalid-email": return "Please enter a valid email address.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    case "auth/user-not-found": return "No account found with this email.";
    case "auth/wrong-password": return "Incorrect password.";
    case "auth/invalid-credential": return "Invalid email or password.";
    default: return "Something went wrong. Please try again.";
  }
}
