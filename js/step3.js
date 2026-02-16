import { auth, db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { requireAuth, getProjectId } from "./router.js";

const form = document.getElementById("step3-form");
const errorEl = document.getElementById("error");
const loading = document.getElementById("loading");
const backLink = document.getElementById("back-link");
const fontSelect = document.getElementById("font-select");
const fontPreviewText = document.getElementById("font-preview-text");
const primaryCustom = document.getElementById("primary-custom");
const accentCustom = document.getElementById("accent-custom");
const customColors = document.getElementById("custom-colors");
const customFonts = document.getElementById("custom-fonts");

const projectId = getProjectId();
if (!projectId) window.location.href = "dashboard.html";

backLink.href = `create-step2.html?id=${projectId}`;

let colorMode = "custom";
let fontMode = "custom";
let formatMode = "html";
let primaryColor = "#000000";
let accentColor = "#555555";

async function init() {
  const user = await requireAuth();

  // Load existing data
  const snap = await getDoc(doc(db, "users", user.uid, "projects", projectId));
  if (snap.exists()) {
    const data = snap.data();
    if (data.styling) {
      colorMode = data.styling.colorMode || "custom";
      fontMode = data.styling.fontMode || "custom";
      primaryColor = data.styling.primaryColor || "#000000";
      accentColor = data.styling.accentColor || "#555555";
      if (data.styling.fontFamily) {
        fontSelect.value = data.styling.fontFamily;
      }
      formatMode = data.styling.format || "html";
    }
  }

  updateColorModeUI();
  updateFontModeUI();
  updateFormatModeUI();
  updateFontPreview();
}

// Format mode toggles
document.querySelectorAll(".format-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    formatMode = btn.dataset.mode;
    updateFormatModeUI();
  });
});

function updateFormatModeUI() {
  const hint = document.getElementById("format-hint");
  document.querySelectorAll(".format-mode-btn").forEach((btn) => {
    if (btn.dataset.mode === formatMode) {
      btn.classList.remove("btn-outline");
    } else {
      btn.classList.add("btn-outline");
    }
  });

  if (formatMode === "html") {
    hint.textContent = "Generates a responsive website.";
  } else {
    hint.textContent = "Generates a high-quality PDF resume using Typst.";
  }
}

// Color mode toggles
document.querySelectorAll(".color-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    colorMode = btn.dataset.mode;
    updateColorModeUI();
  });
});

function updateColorModeUI() {
  document.querySelectorAll(".color-mode-btn").forEach((btn) => {
    if (btn.dataset.mode === colorMode) {
      btn.classList.remove("btn-outline");
    } else {
      btn.classList.add("btn-outline");
    }
  });
  customColors.style.display = colorMode === "custom" ? "" : "none";
}

// Font mode toggles
document.querySelectorAll(".font-mode-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    fontMode = btn.dataset.mode;
    updateFontModeUI();
  });
});

function updateFontModeUI() {
  document.querySelectorAll(".font-mode-btn").forEach((btn) => {
    if (btn.dataset.mode === fontMode) {
      btn.classList.remove("btn-outline");
    } else {
      btn.classList.add("btn-outline");
    }
  });
  customFonts.style.display = fontMode === "custom" ? "" : "none";
}

// Color swatch selection
document.querySelectorAll("#primary-colors .color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.querySelectorAll("#primary-colors .color-swatch").forEach(s => s.classList.remove("selected"));
    swatch.classList.add("selected");
    primaryColor = swatch.dataset.color;
    primaryCustom.value = primaryColor;
  });
});

document.querySelectorAll("#accent-colors .color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", () => {
    document.querySelectorAll("#accent-colors .color-swatch").forEach(s => s.classList.remove("selected"));
    swatch.classList.add("selected");
    accentColor = swatch.dataset.color;
    accentCustom.value = accentColor;
  });
});

primaryCustom.addEventListener("input", (e) => {
  primaryColor = e.target.value;
  document.querySelectorAll("#primary-colors .color-swatch").forEach(s => s.classList.remove("selected"));
});

accentCustom.addEventListener("input", (e) => {
  accentColor = e.target.value;
  document.querySelectorAll("#accent-colors .color-swatch").forEach(s => s.classList.remove("selected"));
});

// Font preview
fontSelect.addEventListener("change", updateFontPreview);

function updateFontPreview() {
  const font = fontSelect.value;
  fontPreviewText.style.fontFamily = `'${font}', sans-serif`;
  // Load Google Font dynamically for preview
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}&display=swap`;
  document.head.appendChild(link);
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
    const projectRef = doc(db, "users", uid, "projects", projectId);

    await updateDoc(projectRef, {
      "styling.colorMode": colorMode,
      "styling.primaryColor": colorMode === "custom" ? primaryColor : "",
      "styling.accentColor": colorMode === "custom" ? accentColor : "",
      "styling.fontMode": fontMode,
      "styling.fontFamily": fontMode === "custom" ? fontSelect.value : "",
      "styling.format": formatMode
    });

    window.location.href = `preview.html?id=${projectId}`;
  } catch (err) {
    console.error(err);
    showError("Failed to save. Please try again.");
    loading.classList.remove("visible");
  }
});

init();
