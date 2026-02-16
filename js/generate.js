import { auth, db } from "./firebase-config.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { requireAuth, getProjectId } from "./router.js";

const GEMINI_API_KEY = "AIzaSyBtu_9ruX7qAXRlfC_OGrQNn2CRwzTJtVU";

const previewFrame = document.getElementById("preview-frame");
const loadingEl = document.getElementById("loading");
const loadingText = document.getElementById("loading-text");
const errorEl = document.getElementById("error");
const pageTitle = document.getElementById("page-title");
const pageSubtitle = document.getElementById("page-subtitle");
const actions = document.getElementById("actions");
const downloadBtn = document.getElementById("download-btn");
const regenerateBtn = document.getElementById("regenerate-btn");

const projectId = getProjectId();
if (!projectId) window.location.href = "dashboard.html";

let generatedHtml = "";
let generatedTypst = "";
let projectData = null;
let knowledgeBase = {};

async function init() {
  const user = await requireAuth();
  const uid = user.uid;

  const snap = await getDoc(doc(db, "users", uid, "projects", projectId));
  if (!snap.exists()) {
    showError("Project not found.");
    loadingEl.classList.remove("visible");
    return;
  }

  projectData = snap.data();

  // Load knowledge base
  const userSnap = await getDoc(doc(db, "users", uid));
  if (userSnap.exists()) {
    knowledgeBase = userSnap.data().knowledgeBase || {};
  }

  // If already generated, show existing
  if (projectData.generatedHtml || projectData.generatedTypst) {
    generatedHtml = projectData.generatedHtml || "";
    generatedTypst = projectData.generatedTypst || "";
    showPreview();
    return;
  }

  await generate();
}

async function generate() {
  loadingEl.classList.add("visible");
  loadingText.textContent = "Building your CV with AI...";
  actions.style.display = "none";
  errorEl.classList.remove("visible");

  try {
    const isTypst = projectData.styling?.format === "typst";
    const prompt = isTypst ? buildTypstPrompt(projectData) : buildPrompt(projectData);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
          }
        })
      }
    );

    if (!response.ok) {
      const err = await response.json();
      console.error("Gemini API Error:", err);
      throw new Error(err.error?.message || "API request failed");
    }

    const data = await response.json();
    console.log("Gemini API Full Response:", data);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("Extracted Text:", text);

    // Extract HTML from the response (may be wrapped in markdown code blocks)
    // Extract content
    if (isTypst) {
      generatedTypst = text.replace(/```typst/g, "").replace(/```/g, "").trim();

      // Save to Firestore
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, "users", uid, "projects", projectId), {
        generatedTypst: generatedTypst,
        status: "generated"
      });
    } else {
      // Extract HTML from the response (may be wrapped in markdown code blocks)
      generatedHtml = extractHtml(text);

      if (!generatedHtml) {
        console.warn("HTML extraction returned empty string for text:", text);
        throw new Error("The AI did not return valid content. Please see the browser console for the raw response.");
      }

      // Save to Firestore
      const uid = auth.currentUser.uid;
      await updateDoc(doc(db, "users", uid, "projects", projectId), {
        generatedHtml: generatedHtml,
        status: "generated"
      });
    }

    showPreview();
  } catch (err) {
    console.error(err);
    showError("Generation failed: " + err.message);
    loadingEl.classList.remove("visible");
    actions.style.display = "flex";
  }
}

function buildPrompt(data) {
  const achievements = data.achievements || {};
  const company = data.company || {};
  const styling = data.styling || {};

  let prompt = `You are an expert web developer specializing in creating professional, modern CV websites.
Your task is to generate a complete, self-contained HTML file for a personal CV website based on the user's data.

CRITICAL INSTRUCTIONS:
1. Output ONLY the raw HTML code. Do not wrap it in markdown code blocks.
2. DESIGN LAYOUT (MANDATORY):
   - Use a **TWO-COLUMN LAYOUT**.
   - **LEFT COLUMN (Main Content, ~65% width)**:
     - **Header**: Name and Title.
     - **Value Proposition**: A strong statement on how the applicant will help [Company].
     - **Experience**: Listed BEFORE Education. Use bullet points with metrics.
     - **Education**: Brief listing at the bottom.
   - **RIGHT COLUMN (Sidebar, ~35% width)**:
     - **Background**: Use a distinct color (one of the brand colors) with white text.
     - **Contact Info**: Email, LinkedIn, Location. Use icons.
     - **Key Achievements**: 3-4 top achievements highlighted with icons.
     - **Skills**: List of relevant skills.
3. STICK TO FACTS: Do NOT imagine information. Use only provided data.
4. METRICS-FOCUSED: Prioritize specific metrics (e.g., "Reduced load time by 40%").
5. STYLING:
   - Use Google Fonts (e.g., Roboto, Open Sans).
   - Ensure high contrast and professional look.

USER PROFILE (Knowledge Base):
- Full Name: ${knowledgeBase.fullName || "Not specified"}
- Title: ${knowledgeBase.title || "Not specified"}
- Email: ${knowledgeBase.email || achievements.email || "Not specified"}
- Phone: ${knowledgeBase.phone || "Not specified"}
- LinkedIn: ${knowledgeBase.linkedin || achievements.linkedin || "Not specified"}
- Location: ${knowledgeBase.location || "Not specified"}
- Summary: ${knowledgeBase.summary || "Not specified"}
- Skills: ${knowledgeBase.skills || "Not specified"}
- Certifications: ${knowledgeBase.certifications || "Not specified"}

WORK EXPERIENCE:
${knowledgeBase.experience || "Not specified"}

EDUCATION:
${knowledgeBase.education || "Not specified"}

ADDITIONAL CONTEXT FROM PROJECT:
`;

  if (achievements.text) {
    prompt += achievements.text + "\n\n";
  }

  if (achievements.fileAnalysis) {
    prompt += `=== Extracted from uploaded file ===\n${achievements.fileAnalysis}\n\n`;
  }

  if (achievements.websiteAnalysis) {
    prompt += `=== Extracted from user's portfolio website ===\n${achievements.websiteAnalysis}\n\n`;
  }

  prompt += `TARGET COMPANY & JOB:\n`;
  prompt += `Company: ${company.name || "Not specified"}\n`;
  if (company.websiteUrl) {
    prompt += `Company website: ${company.websiteUrl}\n`;
  }
  if (company.jobDescription) {
    prompt += `Job Description: ${company.jobDescription}\n`;
  }

  prompt += `\nCreate a hyper-targeted CV for this role. The goal is to show immediately what the applicant can do for ${company.name || "the company"}.\n`;

  if (company.logoData) {
    prompt += `\nThe company logo is provided as a base64 data URL. You can embed it using: <img src="${company.logoData}" alt="${company.name} logo">\nInclude it subtly in the sidebar or header.\n`;
  }

  return prompt;
}

function buildTypstPrompt(data) {
  const achievements = data.achievements || {};
  const company = data.company || {};

  let prompt = `You are an expert Typst typesetter.
Your task is to generate a complete, self-contained Typst (.typ) file for a specific CV.

CRITICAL INSTRUCTIONS:
1. Output ONLY raw Typst code. No markdown blocks.
2. Use the 'modern-cv' template structure defined below.
3. Content MUST be hyper-targeted to the company and role.
4. Follow the value equation: (Dream Outcome * Likelihood) / (Effort * Time).

TEMPLATE STRUCTURE (Implicitly include this at the top of your code):
#let resume(author: "", title: "", contact: (), body) = {
  set document(author: author, title: title)
  set text(font: "Roboto", lang: "en")
  set page(margin: (x: 1cm, y: 1cm))
  
  // Header
  align(center)[
    #text(2em, weight: 700)[#author] \
    #text(1.2em, style: "italic")[#title]
  ]
  
  // Contact
  align(center)[
    #contact.join(" | ")
  ]
  
  line(length: 100%, stroke: 0.5pt)
  
  // Body (2-column)
  grid(
    columns: (2fr, 1fr),
    gutter: 1cm,
    body,
    // Sidebar content would go here if we split it right, but for simplicity use a flow
  )
}

Since Typst grids can be complex for a single file, please use a standard single-column layout with clean headers, BUT prioritize the content hierarchy:
1. Value Proposition (How I help ${company.name})
2. Experience (Metrics based)
3. Projects / Achievements
4. Education
5. Skills

USER PROFILE (Knowledge Base):
Full Name: ${knowledgeBase.fullName || "Not specified"}
Title: ${knowledgeBase.title || "Not specified"}
Email: ${knowledgeBase.email || "Not specified"}
Phone: ${knowledgeBase.phone || "Not specified"}
LinkedIn: ${knowledgeBase.linkedin || "Not specified"}
Location: ${knowledgeBase.location || "Not specified"}
Summary: ${knowledgeBase.summary || "Not specified"}
Skills: ${knowledgeBase.skills || "Not specified"}
Certifications: ${knowledgeBase.certifications || "Not specified"}

Work Experience:
${knowledgeBase.experience || "Not specified"}

Education:
${knowledgeBase.education || "Not specified"}

Target Company: ${company.name}
Job Description: ${company.jobDescription || "Not specified"}

Generate the full Typst code now.
`;
  return prompt;
}

function extractHtml(text) {
  // 1. Try to extract from markdown code blocks
  const codeBlockMatch = text.match(/```(?:html|xml)?\s*([\s\S]*?)```/i);
  let content = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // 2. Check if it's already a full HTML document
  if (content.toLowerCase().includes("<html") || content.toLowerCase().includes("<!doctype")) {
    return content;
  }

  // 3. If it looks like partial HTML (has tags), wrap it in a boilerplate
  if (content.includes("<") && content.includes(">")) {
    return wrapInBoilerplate(content);
  }

  // 4. Fallback: Wrap whatever we have if it's not empty
  if (content.length > 0) {
    return wrapInBoilerplate(`<div class="ai-content">${content.replace(/\n/g, "<br>")}</div>`);
  }

  return "";
}

function wrapInBoilerplate(content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated CV</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 2rem; }
        .ai-content { max-width: 800px; margin: 0 auto; }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
}

function showPreview() {
  loadingEl.classList.remove("visible");
  previewFrame.style.display = "";
  actions.style.display = "flex";

  pageTitle.textContent = `CV for ${projectData.company?.name || "your company"}`;
  pageSubtitle.textContent = "Preview your generated CV website below.";

  if (projectData.generatedTypst) {
    previewFrame.style.display = "none";
    const pre = document.createElement("pre");
    pre.textContent = projectData.generatedTypst;
    pre.style.padding = "20px";
    pre.style.background = "#f5f5f5";
    pre.style.overflow = "auto";
    pre.style.height = "600px";
    pre.id = "typst-preview";

    // Replace iframe with pre if it exists
    const existingPre = document.getElementById("typst-preview");
    if (existingPre) existingPre.replaceWith(pre);
    else previewFrame.parentNode.insertBefore(pre, previewFrame);

    downloadBtn.textContent = "Download .typ File";
  } else {
    const existingPre = document.getElementById("typst-preview");
    if (existingPre) existingPre.remove();

    previewFrame.style.display = "";
    // Write HTML to iframe
    const blob = new Blob([generatedHtml], { type: "text/html" });
    previewFrame.src = URL.createObjectURL(blob);
    downloadBtn.textContent = "Download HTML";
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add("visible");
}

// Download
downloadBtn.addEventListener("click", () => {
  const companyName = (projectData.company?.name || "cv").toLowerCase().replace(/\s+/g, "-");

  if (projectData.generatedTypst) {
    const blob = new Blob([projectData.generatedTypst], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cv-${companyName}.typ`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cv-${companyName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
});

// Regenerate
regenerateBtn.addEventListener("click", () => {
  generatedHtml = "";
  generatedTypst = "";
  previewFrame.style.display = "none";
  const existingPre = document.getElementById("typst-preview");
  if (existingPre) existingPre.remove();
  generate();
});

init();
