document.addEventListener("DOMContentLoaded", init);

const DEFAULT_PROFILES = [
  { id: "kerja", name: "Mode Kerja", icon: "💼", color: "purple", allowedDomains: ["slack.com", "trello.com", "mail.google.com"], mutedDomains: ["youtube.com", "instagram.com", "tiktok.com"] },
  { id: "belajar", name: "Mode Belajar/Kuliah", icon: "📚", color: "blue", allowedDomains: ["elearning.ut.ac.id", "zoom.us", "docs.google.com"], mutedDomains: ["youtube.com", "instagram.com", "tiktok.com", "slack.com"] },
  { id: "santai", name: "Mode Santai", icon: "🎮", color: "green", allowedDomains: [], mutedDomains: [] }
];
const DEFAULT_SETTINGS = { nik: true, email: true, apikey: true, card: true, keywords: true };
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // kuota default chrome.storage.local

let state = { profiles: [], activeProfileId: null, customKeywords: [], settings: {}, nickname: "" };

async function init() {
  const data = await chrome.storage.local.get([
    "profiles", "activeProfileId", "customKeywords", "settings", "nickname"
  ]);
  state.profiles = data.profiles || [];
  state.activeProfileId = data.activeProfileId || (state.profiles[0] && state.profiles[0].id);
  state.customKeywords = data.customKeywords || [];
  state.settings = data.settings || DEFAULT_SETTINGS;
  state.nickname = data.nickname || "Pengguna";

  renderNickname();
  renderActiveCard();
  renderProfiles();
  renderKeywords();
  renderDetectorToggles();
  renderStorageUsage();
  bindNav();
  bindForms();
  bindNicknameEditor();
}

function save(partial) {
  Object.assign(state, partial);
  chrome.storage.local.set(partial).then(renderStorageUsage);
}

// --- Nama panggilan (nickname) --------------------------------------------

function renderNickname() {
  document.getElementById("nicknameText").textContent = state.nickname;
}

function bindNicknameEditor() {
  const row = document.getElementById("nicknameRow");
  const form = document.getElementById("nicknameForm");
  const input = document.getElementById("nicknameInput");

  document.getElementById("btnEditNickname").addEventListener("click", () => {
    input.value = state.nickname === "Pengguna" ? "" : state.nickname;
    row.classList.add("sw-hidden");
    form.classList.remove("sw-hidden");
    input.focus();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = input.value.trim();
    save({ nickname: value || "Pengguna" });
    renderNickname();
    form.classList.add("sw-hidden");
    row.classList.remove("sw-hidden");
  });

  input.addEventListener("blur", () => {
    if (!form.classList.contains("sw-hidden")) form.requestSubmit();
  });
}

// --- Profil ruang kerja ------------------------------------------------

function renderActiveCard() {
  const p = state.profiles.find((x) => x.id === state.activeProfileId);
  document.getElementById("activeIcon").textContent = p ? p.icon : "💼";
  document.getElementById("activeName").textContent = p ? p.name : "-";
  document.getElementById("activeSummary").textContent = p
    ? `${p.allowedDomains.length} domain diizinkan • ${p.mutedDomains.length} domain dibisukan`
    : "-";
}

function renderProfiles() {
  const list = document.getElementById("profileList");
  list.innerHTML = "";
  state.profiles.forEach((p) => {
    const card = document.createElement("div");
    card.className = "sw-profile-card" + (p.id === state.activeProfileId ? " active" : "");

    const domainsText = p.allowedDomains.length
      ? `${p.allowedDomains.join(", ")} diizinkan`
      : "Tanpa pembatasan domain";

    card.innerHTML = `
      <div class="icon">${p.icon}</div>
      <div class="info">
        <div class="name">${p.name}</div>
        <div class="domains">${domainsText}</div>
      </div>
      <button class="sw-delete-btn" data-id="${p.id}" title="Hapus profil ini">🗑️</button>
      <div class="sw-switch ${p.id === state.activeProfileId ? "on" : ""}" data-id="${p.id}"></div>
    `;

    card.querySelector(".sw-switch").addEventListener("click", (e) => {
      e.stopPropagation();
      activateProfile(p.id);
    });

    card.querySelector(".sw-delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.profiles.length <= 1) {
        alert("Minimal harus ada satu profil.");
        return;
      }
      if (confirm(`Hapus profil "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
        deleteProfile(p.id);
      }
    });

    card.addEventListener("click", () => activateProfile(p.id));

    list.appendChild(card);
  });
}

async function activateProfile(id) {
  save({ activeProfileId: id });
  renderActiveCard();
  renderProfiles();
  chrome.runtime.sendMessage({ type: "ACTIVATE_PROFILE", profileId: id });
}

function deleteProfile(id) {
  const profiles = state.profiles.filter((p) => p.id !== id);
  const activeProfileId = state.activeProfileId === id ? (profiles[0] && profiles[0].id) : state.activeProfileId;
  save({ profiles, activeProfileId });
  renderActiveCard();
  renderProfiles();
  if (state.activeProfileId) {
    chrome.runtime.sendMessage({ type: "ACTIVATE_PROFILE", profileId: state.activeProfileId });
  }
}

// --- Local memory usage & hapus data ---------------------------------------

function renderStorageUsage() {
  if (!chrome.storage.local.getBytesInUse) {
    document.getElementById("storageText").textContent = "Tidak tersedia";
    return;
  }
  chrome.storage.local.getBytesInUse(null, (bytes) => {
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    const text = kb < 1024 ? `${kb.toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
    document.getElementById("storageText").textContent = `${text} / 10 MB terpakai`;
    const pct = Math.min(100, (bytes / STORAGE_LIMIT_BYTES) * 100);
    document.getElementById("storageFill").style.width = pct + "%";
  });
}

function bindClearData() {
  document.getElementById("btnClearData").addEventListener("click", () => {
    const ok = confirm(
      "Hapus SEMUA data lokal ekstensi ini?\n\nProfil, kata kunci kustom, nama panggilan, dan log audit akan dihapus permanen dari browser ini. Tindakan ini tidak bisa dibatalkan."
    );
    if (!ok) return;

    chrome.storage.local.clear(() => {
      const resetData = {
        profiles: DEFAULT_PROFILES,
        activeProfileId: DEFAULT_PROFILES[0].id,
        customKeywords: [],
        auditLog: [],
        settings: DEFAULT_SETTINGS,
        nickname: "Pengguna"
      };
      chrome.storage.local.set(resetData, () => {
        state = { ...state, ...resetData };
        renderNickname();
        renderActiveCard();
        renderProfiles();
        renderKeywords();
        renderDetectorToggles();
        renderStorageUsage();
      });
    });
  });
}

// --- Form-form lain ---------------------------------------------------------

function bindForms() {
  document.getElementById("btnAddProfile").addEventListener("click", () => {
    const name = prompt("Nama profil baru (mis. Mode Freelance):");
    if (!name) return;
    const allowed = prompt("Domain yang diizinkan, pisahkan dengan koma (boleh kosong):", "") || "";
    const muted = prompt("Domain yang dibisukan, pisahkan dengan koma (boleh kosong):", "") || "";
    const icon = prompt("Emoji ikon profil (mis. 🚀):", "🗂️") || "🗂️";

    const profile = {
      id: "p" + Date.now(),
      name,
      icon,
      color: "purple",
      allowedDomains: allowed.split(",").map((s) => s.trim()).filter(Boolean),
      mutedDomains: muted.split(",").map((s) => s.trim()).filter(Boolean)
    };
    const profiles = [...state.profiles, profile];
    save({ profiles });
    renderProfiles();
  });

  document.getElementById("keywordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("keywordTerm");
    const term = input.value.trim();
    if (!term) return;
    const customKeywords = [...state.customKeywords, { id: "k" + Date.now(), term, label: term }];
    save({ customKeywords });
    input.value = "";
    renderKeywords();
  });

  ["detNik", "detEmail", "detApikey", "detCard"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const settings = {
        nik: document.getElementById("detNik").checked,
        email: document.getElementById("detEmail").checked,
        apikey: document.getElementById("detApikey").checked,
        card: document.getElementById("detCard").checked,
        keywords: true
      };
      save({ settings });
    });
  });

  document.getElementById("btnDashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  });

  bindClearData();
}

function renderKeywords() {
  const list = document.getElementById("keywordList");
  list.innerHTML = "";
  if (!state.customKeywords.length) {
    list.innerHTML = `<div class="sw-hint">Belum ada kata kunci kustom.</div>`;
    return;
  }
  state.customKeywords.forEach((kw) => {
    const row = document.createElement("div");
    row.className = "sw-keyword-item";
    row.innerHTML = `<span>${kw.term}</span><button data-id="${kw.id}">Hapus</button>`;
    row.querySelector("button").addEventListener("click", () => {
      const customKeywords = state.customKeywords.filter((x) => x.id !== kw.id);
      save({ customKeywords });
      renderKeywords();
    });
    list.appendChild(row);
  });
}

function renderDetectorToggles() {
  document.getElementById("detNik").checked = state.settings.nik !== false;
  document.getElementById("detEmail").checked = state.settings.email !== false;
  document.getElementById("detApikey").checked = state.settings.apikey !== false;
  document.getElementById("detCard").checked = state.settings.card !== false;
}

function bindNav() {
  document.querySelectorAll(".sw-nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sw-nav-item[data-view]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".sw-view").forEach((v) => v.classList.add("sw-hidden"));
      document.getElementById(btn.dataset.view).classList.remove("sw-hidden");
    });
  });
}
