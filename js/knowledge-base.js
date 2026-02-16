import { auth, db } from "./firebase-config.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { requireAuth } from "./router.js";

const form = document.getElementById("kb-form");
const errorEl = document.getElementById("error");
const loading = document.getElementById("loading");

// Field references
const fields = {
    fullName: document.getElementById("kb-fullname"),
    title: document.getElementById("kb-title"),
    email: document.getElementById("kb-email"),
    phone: document.getElementById("kb-phone"),
    linkedin: document.getElementById("kb-linkedin"),
    location: document.getElementById("kb-location"),
    summary: document.getElementById("kb-summary"),
    experience: document.getElementById("kb-experience"),
    education: document.getElementById("kb-education"),
    skills: document.getElementById("kb-skills"),
    certifications: document.getElementById("kb-certifications")
};

async function init() {
    const user = await requireAuth();

    // Pre-fill email from auth
    if (user.email) {
        fields.email.value = user.email;
    }

    // Load existing knowledge base if user is editing
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().knowledgeBase) {
        const kb = userDoc.data().knowledgeBase;
        for (const [key, el] of Object.entries(fields)) {
            if (kb[key]) el.value = kb[key];
        }
    }
}

function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add("visible");
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.remove("visible");
    loading.classList.add("visible");

    try {
        const uid = auth.currentUser.uid;
        const knowledgeBase = {};

        for (const [key, el] of Object.entries(fields)) {
            knowledgeBase[key] = el.value.trim();
        }

        knowledgeBase.completedAt = serverTimestamp();

        await setDoc(doc(db, "users", uid), {
            knowledgeBase
        }, { merge: true });

        window.location.href = "dashboard.html";
    } catch (err) {
        console.error(err);
        showError("Failed to save. Please try again.");
        loading.classList.remove("visible");
    }
});

init();
