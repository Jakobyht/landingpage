import { db } from "./firebase-config.js";
import { collection, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { requireAuth, getProjectId } from "./router.js";

const form = document.getElementById("step2-form");
const companyName = document.getElementById("company-name");
const companyUrl = document.getElementById("company-url");
const jobDescription = document.getElementById("job-description");
const logoInput = document.getElementById("logo-input");
const logoUploadArea = document.getElementById("logo-upload-area");
const logoPreviewContainer = document.getElementById("logo-preview-container");
const logoImg = document.getElementById("logo-img");
const logoName = document.getElementById("logo-name");
const removeLogo = document.getElementById("remove-logo");
const backLink = document.getElementById("back-link");
const errorEl = document.getElementById("error");
const loading = document.getElementById("loading");

let selectedLogo = null;
let projectId = getProjectId();
const isNewProject = !projectId;
let currentUser = null; // Set after requireAuth resolves

backLink.href = "dashboard.html";

/**
 * Convert file to base64 data URL
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function init() {
  currentUser = await requireAuth();

  // Load existing data (only when editing an existing project)
  if (projectId) {
    try {
      const snap = await getDoc(doc(db, "users", currentUser.uid, "projects", projectId));
      if (snap.exists()) {
        const data = snap.data();
        companyName.value = data.company?.name || "";
        companyUrl.value = data.company?.websiteUrl || "";
        jobDescription.value = data.company?.jobDescription || "";
        if (data.company?.logoData) {
          logoImg.src = data.company.logoData;
          logoName.textContent = "Uploaded logo";
          logoPreviewContainer.style.display = "flex";
          logoUploadArea.style.display = "none";
        }
      }
    } catch (err) {
      console.error("Error loading project data:", err);
    }
  }
}

// Logo upload
logoUploadArea.addEventListener("click", () => logoInput.click());

logoInput.addEventListener("change", () => {
  if (logoInput.files.length) {
    const file = logoInput.files[0];
    if (file.size > 5 * 1024 * 1024) {
      showError("Logo file is too large. Maximum 5 MB.");
      return;
    }
    selectedLogo = file;
    logoImg.src = URL.createObjectURL(file);
    logoName.textContent = file.name;
    logoPreviewContainer.style.display = "flex";
    logoUploadArea.style.display = "none";
  }
});

removeLogo.addEventListener("click", () => {
  selectedLogo = null;
  logoInput.value = "";
  logoImg.src = "";
  logoPreviewContainer.style.display = "none";
  logoUploadArea.style.display = "";
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add("visible");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.classList.remove("visible");

  if (!currentUser) {
    showError("Authentication not ready. Please wait a moment and try again.");
    return;
  }

  const name = companyName.value.trim();
  if (!name) {
    showError("Please enter the company name.");
    return;
  }

  loading.classList.add("visible");

  try {
    const uid = currentUser.uid;
    const projectRef = projectId
      ? doc(db, "users", uid, "projects", projectId)
      : doc(collection(db, "users", uid, "projects"));

    if (!projectId) {
      projectId = projectRef.id;
      sessionStorage.setItem("currentProjectId", projectId);
    }

    // Preserve existing logo if no new one was selected
    let logoData = "";
    if (selectedLogo) {
      logoData = await fileToBase64(selectedLogo);
    } else if (!isNewProject) {
      const snap = await getDoc(projectRef);
      logoData = snap.data()?.company?.logoData || "";
    }

    await setDoc(projectRef, {
      ...(isNewProject ? { status: "draft", createdAt: serverTimestamp() } : {}),
      company: {
        name,
        websiteUrl: companyUrl.value.trim(),
        jobDescription: jobDescription.value.trim(),
        logoData
      }
    }, { merge: true });

    window.location.href = `create-step3.html?id=${projectId}`;
  } catch (err) {
    console.error("Step 2 save error:", err);
    showError(`Failed to save: ${err.message || "Please try again."}`);
    loading.classList.remove("visible");
  }
});

init();
