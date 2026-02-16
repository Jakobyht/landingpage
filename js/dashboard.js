import { auth, db } from "./firebase-config.js";
import { signOut } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js";
import { collection, query, orderBy, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js";
import { requireAuth, requireKnowledgeBase } from "./router.js";

const container = document.getElementById("projects-container");
const emptyState = document.getElementById("empty-state");
const loading = document.getElementById("loading");
const logoutBtn = document.getElementById("logout-btn");

async function init() {
  loading.classList.add("visible");
  const user = await requireAuth();
  const hasKB = await requireKnowledgeBase(user);
  if (!hasKB) return;
  await loadProjects(user.uid);
  loading.classList.remove("visible");
}

async function loadProjects(uid) {
  const q = query(
    collection(db, "users", uid, "projects"),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    emptyState.style.display = "";
    return;
  }

  emptyState.style.display = "none";

  const grid = document.createElement("div");
  grid.className = "card-grid";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const card = document.createElement("div");
    card.className = "card";

    const companyName = data.company?.name || "Untitled";
    const status = data.status || "draft";
    const date = data.createdAt?.toDate?.()
      ? data.createdAt.toDate().toLocaleDateString()
      : "—";

    card.innerHTML = `
      <div class="card-title">${escapeHtml(companyName)}</div>
      <div class="card-meta">${status === "generated" ? "Generated" : "Draft"} &middot; ${date}</div>
      <div class="card-actions">
        ${status === "generated"
        ? `<a href="preview.html?id=${docSnap.id}" class="btn btn-sm">View</a>`
        : `<a href="create-step1.html?id=${docSnap.id}" class="btn btn-sm btn-outline">Continue</a>`
      }
        <button class="btn btn-sm btn-outline delete-btn" data-id="${docSnap.id}">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  });

  container.innerHTML = "";
  container.appendChild(grid);

  // Attach delete handlers
  grid.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this project?")) return;
      const id = btn.dataset.id;
      await deleteDoc(doc(db, "users", auth.currentUser.uid, "projects", id));
      btn.closest(".card").remove();
      // Show empty state if no more cards
      if (grid.children.length === 0) {
        container.innerHTML = "";
        container.appendChild(emptyState);
        emptyState.style.display = "";
      }
    });
  });
}

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

init();
