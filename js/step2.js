import { auth, db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
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
const projectId = getProjectId();

if (!projectId) {
  window.location.href = "dashboard.html";
}

backLink.href = `create-step1.html?id=${projectId}`;

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
  const user = await requireAuth();

  // Load existing data
  const snap = await getDoc(doc(db, "users", user.uid, "projects", projectId));
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

  const name = companyName.value.trim();
  if (!name) {
    showError("Please enter the company name.");
    return;
  }

  loading.classList.add("visible");

  try {
    const uid = auth.currentUser.uid;
    const projectRef = doc(db, "users", uid, "projects", projectId);

    let logoData = "";
    // Convert logo to base64 if new file selected
    if (selectedLogo) {
      logoData = await fileToBase64(selectedLogo);
    } else {
      // Keep existing logo
      const snap = await getDoc(projectRef);
      logoData = snap.data()?.company?.logoData || "";
    }

    await updateDoc(projectRef, {
      "company.name": name,
      "company.websiteUrl": companyUrl.value.trim(),
      "company.jobDescription": jobDescription.value.trim(),
      "company.logoData": logoData
    });

    window.location.href = `create-step3.html?id=${projectId}`;
  } catch (err) {
    console.error(err);
    showError("Failed to save. Please try again.");
    loading.classList.remove("visible");
  }
});

init();
