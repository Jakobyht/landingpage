import { auth, db } from "./firebase-config.js";
import { collection, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { requireAuth, getProjectId } from "./router.js";

const GLM_API_KEY = "modalresearch_IxC5_YNq7jLS1KsZLhmDNVA0R3LF9y8ALj4jA5UyaqQ";

const form = document.getElementById("step1-form");
const textArea = document.getElementById("achievements-text");
const fileInput = document.getElementById("file-input");
const uploadArea = document.getElementById("upload-area");
const filePreview = document.getElementById("file-preview");
const fileName = document.getElementById("file-name");
const removeFile = document.getElementById("remove-file");
const contactEmail = document.getElementById("contact-email");
const contactLinkedin = document.getElementById("contact-linkedin");
const errorEl = document.getElementById("error");
const loading = document.getElementById("loading");
const loadingText = document.getElementById("loading-text");

let selectedFile = null;
let existingProjectId = getProjectId();

/**
 * Analyze a file (PDF or image) using GLM API
 */
async function analyzeFile(file) {
  const fileData = await fileToBase64(file);
  const mimeType = file.type;

  const prompt = file.type === "application/pdf"
    ? "Extract all text content from this document. Include information about work experience, education, skills, projects, and achievements. Format the output as a structured summary."
    : "Analyze this image and extract any visible text, information about work experience, education, skills, or achievements. Describe the layout and content.";

  try {
    const response = await fetch(
      "https://corsproxy.io/?https://api.us-west-2.modal.direct/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GLM_API_KEY}`
        },
        body: JSON.stringify({
          model: "zai-org/GLM-5-FP8",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${fileData}`
                  }
                }
              ]
            }
          ],
          max_tokens: 2000
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "GLM API request failed");
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("GLM analysis error:", err);
    throw err;
  }
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function init() {
  const user = await requireAuth();

  // If editing existing project, load data
  if (existingProjectId) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid, "projects", existingProjectId));
      if (snap.exists()) {
        const data = snap.data();
        const achievements = data.achievements || {};

        // Combine text with any previous analysis
        let combinedText = achievements.text || "";
        if (achievements.fileAnalysis) {
          combinedText += (combinedText ? "\n\n" : "") + "=== Extracted from file ===\n" + achievements.fileAnalysis;
        }

        textArea.value = combinedText;
        contactEmail.value = achievements.email || "";
        contactLinkedin.value = achievements.linkedin || "";
      } else {
        showError("Project not found. Starting a new project.");
        existingProjectId = null;
      }
    } catch (err) {
      console.error("Error loading project:", err);
      showError("Failed to load existing project data. You can still create a new project.");
      existingProjectId = null;
    }
  }
}

// Drag & drop + click upload
uploadArea.addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = "#000";
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.style.borderColor = "";
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.style.borderColor = "";
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    handleFile(fileInput.files[0]);
  }
});

async function handleFile(file) {
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    showError("File is too large. Maximum size is 10 MB.");
    return;
  }

  // Show loading state
  fileName.textContent = `Processing ${file.name}...`;
  filePreview.style.display = "flex";
  uploadArea.style.display = "none";

  selectedFile = file;

  // Extract text from PDF or convert image to base64
  if (file.type === "application/pdf") {
    fileName.textContent = `${file.name} (PDF will be analyzed)`;
  } else if (file.type.startsWith("image/")) {
    fileName.textContent = `${file.name} (Image will be analyzed)`;
  } else {
    fileName.textContent = file.name;
  }
}

removeFile.addEventListener("click", () => {
  selectedFile = null;
  fileInput.value = "";
  filePreview.style.display = "none";
  uploadArea.style.display = "";
});

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add("visible");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.classList.remove("visible");

  const text = textArea.value.trim();

  if (!text && !selectedFile) {
    showError("Please provide at least one source of information.");
    return;
  }

  loading.classList.add("visible");

  try {
    const uid = auth.currentUser.uid;

    if (!uid) {
      throw new Error("auth/not-authenticated");
    }

    const projectRef = existingProjectId
      ? doc(db, "users", uid, "projects", existingProjectId)
      : doc(collection(db, "users", uid, "projects"));

    const projectId = projectRef.id;
    sessionStorage.setItem("currentProjectId", projectId);

    // Analyze file if present (optional - won't fail if API doesn't work)
    let fileAnalysis = "";
    if (selectedFile) {
      try {
        loadingText.textContent = "Analyzing your file...";
        fileAnalysis = await analyzeFile(selectedFile);
      } catch (analysisErr) {
        console.error("File analysis error:", analysisErr);
        console.warn("Skipping file analysis - API may not support vision");
        // Don't fail, just skip the analysis
        fileAnalysis = "";
      }
    }

    // Save to Firestore
    try {
      loadingText.textContent = "Saving...";
      await setDoc(projectRef, {
        status: "draft",
        createdAt: serverTimestamp(),
        achievements: {
          text: text,
          fileAnalysis: fileAnalysis,
          email: contactEmail.value.trim(),
          linkedin: contactLinkedin.value.trim()
        }
      }, { merge: true });
    } catch (firestoreErr) {
      console.error("Firestore save error:", firestoreErr);
      console.error("Error code:", firestoreErr.code);
      console.error("Error message:", firestoreErr.message);

      // Throw error with code for better handling
      const error = new Error(`firestore/save-failed: ${firestoreErr.message}`);
      error.code = firestoreErr.code;
      throw error;
    }

    window.location.href = `create-step2.html?id=${projectId}`;
  } catch (err) {
    console.error(err);

    // Provide specific error messages based on error type
    if (err.message === "auth/not-authenticated") {
      showError("You are not logged in. Please log in and try again.");
    } else if (err.message === "file/analysis-failed") {
      showError("Failed to analyze the uploaded file. Please try a different file or use text input.");
    } else if (err.code === "permission-denied") {
      showError("Permission denied. Go to Firebase Console → Firestore → Rules and enable writes.");
    } else if (err.code === "unavailable") {
      showError("Firestore is not available. Enable Firestore Database in Firebase Console.");
    } else if (err.code === "unauthenticated") {
      showError("Not authenticated. Please log out and log back in.");
    } else if (err.message?.startsWith("firestore/save-failed")) {
      // Show detailed error for debugging
      showError(`Save failed: ${err.message}. Check browser console for details.`);
    } else if (err.message?.includes("network")) {
      showError("Network error. Please check your internet connection.");
    } else {
      showError(`Error: ${err.message || "Failed to save. Please try again."}`);
    }

    loading.classList.remove("visible");
  }
});

init();
