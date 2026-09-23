document.addEventListener("DOMContentLoaded", init);

const DEFAULT_PROFILES = [
  {
    id: "kerja",
    name: "Mode Kerja",
    icon: "bi-briefcase-fill",
    color: "purple",
    allowedDomains: ["slack.com", "trello.com", "mail.google.com"],
    mutedDomains: ["youtube.com", "instagram.com", "tiktok.com"]
  },
  {
    id: "belajar",
    name: "Mode Belajar/Kuliah",
    icon: "bi-mortarboard-fill",
    color: "blue",
    allowedDomains: ["elearning.ut.ac.id", "zoom.us", "docs.google.com"],
    mutedDomains: ["youtube.com", "instagram.com", "tiktok.com", "slack.com"]
  },
  {
    id: "santai",
    name: "Mode Santai",
    icon: "bi-controller",
    color: "green",
    allowedDomains: [],
    mutedDomains: []
  }
];

const PRESET_ICONS = [
  "bi-briefcase-fill",
  "bi-mortarboard-fill",
  "bi-controller",
  "bi-laptop",
  "bi-code-slash",
  "bi-book-fill",
  "bi-cup-hot-fill",
  "bi-shield-check",
  "bi-palette-fill",
  "bi-camera-video-fill",
  "bi-headset",
  "bi-rocket-takeoff-fill"
];

const DEFAULT_SETTINGS = { nik: true, email: true, apikey: true, card: true, keywords: true };
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // Kuota 10 MB chrome.storage.local

let state = {
  profiles: [],
  activeProfileId: null,
  customKeywords: [],
  settings: {},
  nickname: "",
  auditLog: []
};

let searchQuery = "";
let currentDetailProfileId = null;

function normalizeIcon(icon) {
  if (!icon) return "bi-collection-fill";
  if (icon.startsWith("bi-")) return icon;
  const map = {
    "💼": "bi-briefcase-fill",
    "📚": "bi-mortarboard-fill",
    "🎮": "bi-controller",
    "🚀": "bi-rocket-takeoff-fill",
    "🗂️": "bi-folder-fill",
    "💻": "bi-laptop",
    "☕": "bi-cup-hot-fill"
  };
  return map[icon] || "bi-collection-fill";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function init() {
  const data = await chrome.storage.local.get([
    "profiles", "activeProfileId", "customKeywords", "settings", "nickname", "auditLog"
  ]);

  state.profiles = (data.profiles && data.profiles.length) ? data.profiles.map(p => ({ ...p, icon: normalizeIcon(p.icon) })) : DEFAULT_PROFILES;
  state.activeProfileId = data.activeProfileId || (state.profiles[0] && state.profiles[0].id);
  state.customKeywords = data.customKeywords || [];
  state.settings = data.settings || DEFAULT_SETTINGS;
  state.nickname = data.nickname || "Pengguna";
  state.auditLog = data.auditLog || [];

  renderNickname();
  renderActiveCard();
  renderProfiles();
  renderKeywords();
  renderDetectorToggles();
  renderStorageUsage();
  renderRecentLeaks();

  bindNav();
  bindSearch();
  bindModals();
  bindForms();
  bindNicknameEditor();
}

function save(partial) {
  Object.assign(state, partial);
  chrome.storage.local.set(partial).then(() => {
    renderStorageUsage();
  });
}

// --- Nama Panggilan (Nickname) --------------------------------------------

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

// --- Profil Aktif ---------------------------------------------------------

function renderActiveCard() {
  const p = state.profiles.find((x) => x.id === state.activeProfileId) || state.profiles[0];
  const iconEl = document.getElementById("activeIcon");
  iconEl.className = `bi ${p ? p.icon : "bi-briefcase-fill"}`;
  document.getElementById("activeName").textContent = p ? p.name : "-";
  document.getElementById("activeSummary").textContent = p
    ? `${p.allowedDomains.length} domain diizinkan • ${p.mutedDomains.length} domain dibisukan`
    : "-";
}

// --- Dynamic Search -------------------------------------------------------

function bindSearch() {
  const searchInput = document.getElementById("searchModeInput");
  const clearBtn = document.getElementById("btnClearSearch");

  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    if (searchQuery) {
      clearBtn.classList.remove("sw-hidden");
    } else {
      clearBtn.classList.add("sw-hidden");
    }
    renderProfiles();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearBtn.classList.add("sw-hidden");
    renderProfiles();
    searchInput.focus();
  });
}

// --- Horizontal Mode List ("kekanan") -------------------------------------

function renderProfiles() {
  const list = document.getElementById("profileList");
  list.innerHTML = "";

  const filtered = state.profiles.filter((p) => {
    if (!searchQuery) return true;
    return p.name.toLowerCase().includes(searchQuery);
  });

  if (!filtered.length) {
    list.innerHTML = `
      <div class="sw-empty-search">
        <i class="bi bi-search"></i>
        Tidak ada mode yang cocok dengan "<strong>${escapeHtml(searchQuery)}</strong>"
      </div>
    `;
    return;
  }

  filtered.forEach((p) => {
    const card = document.createElement("div");
    const isActive = p.id === state.activeProfileId;
    card.className = "sw-profile-card" + (isActive ? " active" : "");

    const allowedLabel = p.allowedDomains && p.allowedDomains.length
      ? `${p.allowedDomains.length} Domain Diizinkan`
      : "Semua Domain Bebas";

    const mutedLabel = p.mutedDomains && p.mutedDomains.length
      ? `${p.mutedDomains.length} Domain Dibisukan`
      : "Tanpa Mute Audio";

    card.innerHTML = `
      <div class="sw-card-top">
        <div class="sw-card-icon">
          <i class="bi ${p.icon}"></i>
        </div>
        <div class="sw-card-title-wrap">
          <div class="sw-card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="sw-card-status-label">${isActive ? '<i class="bi bi-check2-circle"></i> Sedang Aktif' : 'Klik aktifkan'}</div>
        </div>
        <div class="sw-switch ${isActive ? "on" : ""}" data-id="${p.id}" title="Toggle aktifkan mode"></div>
      </div>

      <div class="sw-card-badges">
        <div class="sw-card-badge-row allowed" title="${p.allowedDomains.join(', ')}">
          <i class="bi bi-check-circle-fill"></i>
          <span>${allowedLabel}</span>
        </div>
        <div class="sw-card-badge-row muted" title="${p.mutedDomains.join(', ')}">
          <i class="bi bi-volume-mute-fill"></i>
          <span>${mutedLabel}</span>
        </div>
      </div>

      <div class="sw-card-actions">
        <button class="sw-card-action-btn sw-btn-eye" data-id="${p.id}" title="Lihat detail izin apa saja yang diizinkan dan tidak diizinkan">
          <i class="bi bi-eye"></i>
        </button>
        <button class="sw-card-action-btn sw-btn-edit" data-id="${p.id}" title="Edit mode dan detail isian">
          <i class="bi bi-pencil-square"></i>
        </button>
        <button class="sw-card-action-btn sw-btn-trash" data-id="${p.id}" title="Hapus mode ini">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    `;

    // Klik tombol switch
    card.querySelector(".sw-switch").addEventListener("click", (e) => {
      e.stopPropagation();
      activateProfile(p.id);
    });

    // Klik tombol mata (Detail aturan)
    card.querySelector(".sw-btn-eye").addEventListener("click", (e) => {
      e.stopPropagation();
      openDetailModal(p.id);
    });

    // Klik tombol edit
    card.querySelector(".sw-btn-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditModal(p.id);
    });

    // Klik tombol trash
    card.querySelector(".sw-btn-trash").addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.profiles.length <= 1) {
        alert("Minimal harus ada satu profil ruang kerja.");
        return;
      }
      if (confirm(`Hapus mode "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
        deleteProfile(p.id);
      }
    });

    // Klik card untuk mengaktifkan
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

// --- Detail Modal (Allowed & Disallowed) -----------------------------------

function openDetailModal(profileId) {
  const p = state.profiles.find((x) => x.id === profileId);
  if (!p) return;
  currentDetailProfileId = profileId;

  document.getElementById("detailIcon").className = `bi ${p.icon}`;
  document.getElementById("detailName").textContent = p.name;

  // Render Allowed
  const allowedEl = document.getElementById("detailAllowed");
  allowedEl.innerHTML = "";
  if (p.allowedDomains && p.allowedDomains.length) {
    p.allowedDomains.forEach((dom) => {
      const tag = document.createElement("span");
      tag.className = "sw-domain-tag allowed";
      tag.innerHTML = `<i class="bi bi-check2"></i> ${escapeHtml(dom)}`;
      allowedEl.appendChild(tag);
    });
  } else {
    allowedEl.innerHTML = `<span class="sw-domain-tag empty"><i class="bi bi-globe"></i> Bebas (Semua domain diizinkan)</span>`;
  }

  // Render Muted
  const mutedEl = document.getElementById("detailMuted");
  mutedEl.innerHTML = "";
  if (p.mutedDomains && p.mutedDomains.length) {
    p.mutedDomains.forEach((dom) => {
      const tag = document.createElement("span");
      tag.className = "sw-domain-tag muted";
      tag.innerHTML = `<i class="bi bi-volume-mute"></i> ${escapeHtml(dom)}`;
      mutedEl.appendChild(tag);
    });
  } else {
    mutedEl.innerHTML = `<span class="sw-domain-tag empty"><i class="bi bi-volume-up"></i> Tidak ada domain yang dibisukan audio</span>`;
  }

  document.getElementById("modalDetailMode").classList.remove("sw-hidden");
}

function closeDetailModal() {
  document.getElementById("modalDetailMode").classList.add("sw-hidden");
}

// --- Edit & Tambah Mode Modal ---------------------------------------------

function setupIconSelector(selectedIcon) {
  const container = document.getElementById("iconSelector");
  container.innerHTML = "";
  const inputIcon = document.getElementById("inputEditIcon");

  PRESET_ICONS.forEach((ic) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sw-icon-opt" + (ic === selectedIcon ? " selected" : "");
    btn.innerHTML = `<i class="bi ${ic}"></i>`;
    btn.addEventListener("click", () => {
      container.querySelectorAll(".sw-icon-opt").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      inputIcon.value = ic;
    });
    container.appendChild(btn);
  });
}

function openEditModal(profileId = null) {
  const modal = document.getElementById("modalEditMode");
  const heading = document.getElementById("editModalTitle");
  const inputId = document.getElementById("editModeId");
  const inputName = document.getElementById("inputEditName");
  const inputIcon = document.getElementById("inputEditIcon");
  const inputAllowed = document.getElementById("inputEditAllowed");
  const inputMuted = document.getElementById("inputEditMuted");

  if (profileId) {
    const p = state.profiles.find((x) => x.id === profileId);
    if (!p) return;
    heading.textContent = `Edit: ${p.name}`;
    inputId.value = p.id;
    inputName.value = p.name;
    inputIcon.value = p.icon;
    inputAllowed.value = (p.allowedDomains || []).join(", ");
    inputMuted.value = (p.mutedDomains || []).join(", ");
    setupIconSelector(p.icon);
  } else {
    heading.textContent = "Tambah Mode Baru";
    inputId.value = "";
    inputName.value = "";
    inputIcon.value = "bi-briefcase-fill";
    inputAllowed.value = "";
    inputMuted.value = "";
    setupIconSelector("bi-briefcase-fill");
  }

  closeDetailModal();
  modal.classList.remove("sw-hidden");
  inputName.focus();
}

function closeEditModal() {
  document.getElementById("modalEditMode").classList.add("sw-hidden");
}

function bindModals() {
  // Detail Modal Events
  document.getElementById("btnCloseDetail").addEventListener("click", closeDetailModal);
  document.getElementById("btnCloseDetailBottom").addEventListener("click", closeDetailModal);
  document.getElementById("backdropDetail").addEventListener("click", closeDetailModal);

  document.getElementById("btnEditFromDetail").addEventListener("click", () => {
    if (currentDetailProfileId) {
      openEditModal(currentDetailProfileId);
    }
  });

  // Edit Modal Events
  document.getElementById("btnCloseEdit").addEventListener("click", closeEditModal);
  document.getElementById("btnCancelEdit").addEventListener("click", closeEditModal);
  document.getElementById("backdropEdit").addEventListener("click", closeEditModal);

  document.getElementById("btnAddProfile").addEventListener("click", () => {
    openEditModal(null);
  });

  document.getElementById("formEditMode").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("editModeId").value;
    const name = document.getElementById("inputEditName").value.trim();
    const icon = document.getElementById("inputEditIcon").value || "bi-briefcase-fill";
    const allowedRaw = document.getElementById("inputEditAllowed").value;
    const mutedRaw = document.getElementById("inputEditMuted").value;

    if (!name) return;

    const allowedDomains = allowedRaw.split(",")
      .map(s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean);

    const mutedDomains = mutedRaw.split(",")
      .map(s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
      .filter(Boolean);

    if (id) {
      // Update Mode
      const profiles = state.profiles.map((p) => {
        if (p.id === id) {
          return { ...p, name, icon, allowedDomains, mutedDomains };
        }
        return p;
      });
      save({ profiles });
      if (state.activeProfileId === id) {
        chrome.runtime.sendMessage({ type: "ACTIVATE_PROFILE", profileId: id });
      }
    } else {
      // Mode Baru
      const newProfile = {
        id: "m" + Date.now(),
        name,
        icon,
        color: "purple",
        allowedDomains,
        mutedDomains
      };
      const profiles = [...state.profiles, newProfile];
      save({ profiles });
    }

    renderActiveCard();
    renderProfiles();
    closeEditModal();
  });
}

// --- Circular Battery Memory Bar (Top) ------------------------------------

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

    const pct = Math.min(100, Math.max(0, (bytes / STORAGE_LIMIT_BYTES) * 100));
    const circle = document.getElementById("batteryCircle");
    circle.style.setProperty("--mem-pct", `${pct.toFixed(1)}%`);

    document.getElementById("batteryPct").textContent = `${Math.round(pct)}%`;

    const badge = document.getElementById("storageBadge");
    circle.classList.remove("warning", "danger");
    badge.classList.remove("safe", "warning", "danger");

    if (pct < 70) {
      badge.textContent = "Aman";
      badge.classList.add("safe");
    } else if (pct < 90) {
      badge.textContent = "Waspada";
      badge.classList.add("warning");
      circle.classList.add("warning");
    } else {
      badge.textContent = "Penuh";
      badge.classList.add("danger");
      circle.classList.add("danger");
    }
  });
}

function bindClearData() {
  document.getElementById("btnClearData").addEventListener("click", () => {
    const ok = confirm(
      "Hapus SEMUA data lokal ekstensi ini?\n\nProfil, kata kunci kustom, nama panggilan, dan log audit akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
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
        renderRecentLeaks();
      });
    });
  });
}

// --- Preview Kebocoran Terakhir -------------------------------------------

function renderRecentLeaks() {
  const container = document.getElementById("leakRecentContent");
  const badge = document.getElementById("leakCountBadge");
  const log = state.auditLog || [];

  badge.textContent = `${log.length} Tercegat`;

  if (!log.length) {
    container.innerHTML = `<div class="sw-hint-muted">Belum ada kebocoran data terdeteksi. Sistem aktif memindai NIK, Email, API Key, dan Kartu.</div>`;
    return;
  }

  const latest = log[0];
  const itemsText = (latest.items || []).map((it) => {
    const sampleStr = (it.samples && it.samples.length) ? it.samples.join(", ") : (it.sample || "");
    const sampleDisplay = sampleStr ? `: "${escapeHtml(sampleStr)}"` : "";
    return `<strong>${escapeHtml(it.label)}</strong> (${it.count}x)${sampleDisplay}`;
  }).join(" • ") || "Data Sensitif";

  const actionText = latest.action === "sanitized"
    ? `<span class="text-success"><i class="bi bi-shield-check"></i> Disamarkan</span>`
    : `<span class="text-danger"><i class="bi bi-send-exclamation"></i> Dikirim Asli (Override)</span>`;

  container.innerHTML = `
    <div class="sw-leak-recent-item">
      <div class="sw-leak-recent-header">
        <span>${actionText}</span>
        <span style="color:#64748b; font-weight:normal;">${latest.domain}</span>
      </div>
      <div class="sw-leak-recent-detail">
        ${itemsText}
      </div>
    </div>
  `;
}

// --- Forms & Nav ----------------------------------------------------------

function bindForms() {
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
    row.innerHTML = `<span><i class="bi bi-tag-fill text-primary" style="margin-right:4px;"></i>${escapeHtml(kw.term)}</span><button data-id="${kw.id}"><i class="bi bi-trash"></i></button>`;
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
