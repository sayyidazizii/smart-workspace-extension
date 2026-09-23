document.addEventListener("DOMContentLoaded", init);

const DEFAULT_PROFILES = [
  {
    id: "kerja",
    name: "Mode Kerja",
    icon: "bi-briefcase-fill",
    color: "green",
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
    color: "orange",
    allowedDomains: [],
    mutedDomains: []
  }
];

const MODE_THEMES = {
  kerja: {
    themeClass: "theme-kerja",
    headerBg: "#163300",
    pillBg: "#9fe870",
    pillColor: "#163300",
    accent: "#9fe870",
    canvasBg: "#f1f6ed",
    topbarBg: "#f8fbf6",
    batteryBg: "#edf5e8",
    navBg: "#163300",
    borderSoft: "#dce7d6",
    cardActiveBorder: "#163300"
  },
  belajar: {
    themeClass: "theme-belajar",
    headerBg: "#0a2640",
    pillBg: "#38bdf8",
    pillColor: "#082f49",
    accent: "#38bdf8",
    canvasBg: "#ecf4fa",
    topbarBg: "#f4f9fd",
    batteryBg: "#e3f0f9",
    navBg: "#0a2640",
    borderSoft: "#cde1f0",
    cardActiveBorder: "#0284c7"
  },
  santai: {
    themeClass: "theme-santai",
    headerBg: "#341407",
    pillBg: "#fb923c",
    pillColor: "#431407",
    accent: "#fb923c",
    canvasBg: "#faf1eb",
    topbarBg: "#fdf8f4",
    batteryBg: "#faebe1",
    navBg: "#341407",
    borderSoft: "#ecdcd1",
    cardActiveBorder: "#ea580c"
  },
  custom: {
    themeClass: "theme-custom",
    headerBg: "#25093e",
    pillBg: "#c084fc",
    pillColor: "#3b0764",
    accent: "#c084fc",
    canvasBg: "#f5eefb",
    topbarBg: "#faf5fd",
    batteryBg: "#f0e4fa",
    navBg: "#25093e",
    borderSoft: "#e2d2f2",
    cardActiveBorder: "#9333ea"
  }
};

const POPULAR_ALLOWED_SUGGESTIONS = [
  { domain: "slack.com", icon: "bi-slack" },
  { domain: "mail.google.com", icon: "bi-envelope-at" },
  { domain: "github.com", icon: "bi-github" },
  { domain: "trello.com", icon: "bi-kanban" },
  { domain: "notion.so", icon: "bi-journal-text" },
  { domain: "figma.com", icon: "bi-palette" },
  { domain: "docs.google.com", icon: "bi-file-earmark-text" },
  { domain: "zoom.us", icon: "bi-camera-video" },
  { domain: "elearning.ut.ac.id", icon: "bi-mortarboard" },
  { domain: "coursera.org", icon: "bi-book" },
  { domain: "gitlab.com", icon: "bi-code-square" },
  { domain: "linear.app", icon: "bi-check2-circle" }
];

const POPULAR_MUTED_SUGGESTIONS = [
  { domain: "youtube.com", icon: "bi-youtube" },
  { domain: "instagram.com", icon: "bi-instagram" },
  { domain: "tiktok.com", icon: "bi-tiktok" },
  { domain: "facebook.com", icon: "bi-facebook" },
  { domain: "x.com", icon: "bi-twitter-x" },
  { domain: "netflix.com", icon: "bi-film" },
  { domain: "spotify.com", icon: "bi-spotify" },
  { domain: "twitch.tv", icon: "bi-twitch" },
  { domain: "reddit.com", icon: "bi-reddit" },
  { domain: "discord.com", icon: "bi-discord" }
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
let hasDragged = false;

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

function getModeTheme(p) {
  if (!p) return MODE_THEMES.kerja;
  if (MODE_THEMES[p.id]) return MODE_THEMES[p.id];
  const name = (p.name || "").toLowerCase();
  const icon = (p.icon || "").toLowerCase();
  if (name.includes("kerja") || name.includes("work") || icon.includes("briefcase") || icon.includes("laptop") || icon.includes("code")) {
    return MODE_THEMES.kerja;
  }
  if (name.includes("belajar") || name.includes("kuliah") || name.includes("study") || icon.includes("mortarboard") || icon.includes("book")) {
    return MODE_THEMES.belajar;
  }
  if (name.includes("santai") || name.includes("game") || name.includes("relax") || icon.includes("controller")) {
    return MODE_THEMES.santai;
  }
  return MODE_THEMES.custom;
}

async function init() {
  try {
    let data = {};
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      data = await chrome.storage.local.get([
        "profiles", "activeProfileId", "customKeywords", "settings", "nickname", "auditLog"
      ]);
    }

    state.profiles = (data.profiles && data.profiles.length)
      ? data.profiles.map(p => ({ ...p, icon: normalizeIcon(p.icon) }))
      : DEFAULT_PROFILES;
    state.activeProfileId = data.activeProfileId || (state.profiles[0] && state.profiles[0].id);
    state.customKeywords = data.customKeywords || [];
    state.settings = data.settings || DEFAULT_SETTINGS;
    state.nickname = data.nickname || "Pengguna";
    state.auditLog = data.auditLog || [];

    renderNickname();
    renderActiveHeader();
    renderProfiles();
    renderKeywords();
    renderDetectorToggles();
    renderStorageUsage();

    bindNav();
    bindSearch();
    bindCarouselSwipe();
    bindModals();
    bindForms();
    bindNicknameEditor();
  } catch (err) {
    console.error("Smart Workspace popup init error:", err);
  }
}

function save(partial) {
  Object.assign(state, partial);
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set(partial).then(() => {
      renderStorageUsage();
    }).catch((err) => {
      console.warn("Storage save error:", err);
    });
  } else {
    renderStorageUsage();
  }
}

// --- Nama Panggilan (Nickname) --------------------------------------------

function renderNickname() {
  const el = document.getElementById("nicknameText");
  if (el) el.textContent = state.nickname;
}

function bindNicknameEditor() {
  const row = document.getElementById("nicknameRow");
  const form = document.getElementById("nicknameForm");
  const input = document.getElementById("nicknameInput");
  const btn = document.getElementById("btnEditNickname");

  if (!btn || !row || !form || !input) return;

  btn.addEventListener("click", () => {
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

// --- Header Profil Aktif Dinamis (Beda Mode Beda Warna) --------------------

function renderActiveHeader() {
  const p = state.profiles.find((x) => x.id === state.activeProfileId) || state.profiles[0];
  if (!p) return;

  const theme = getModeTheme(p);

  // Ubah seluruh latar dan suasana warna ekstensi (Full Atmosphere Base Theme)
  if (document.body) {
    document.body.className = theme.themeClass;
  }
  const root = document.documentElement;
  if (root) {
    root.style.setProperty("--theme-bg", theme.headerBg);
    root.style.setProperty("--theme-accent", theme.pillBg);
    root.style.setProperty("--theme-text", theme.pillColor);
    root.style.setProperty("--theme-canvas", theme.canvasBg || "#f1f6ed");
    root.style.setProperty("--theme-topbar", theme.topbarBg || "#f8fbf6");
    root.style.setProperty("--theme-battery-bg", theme.batteryBg || "#edf5e8");
    root.style.setProperty("--theme-nav", theme.navBg || "#163300");
    root.style.setProperty("--theme-border-soft", theme.borderSoft || "#dce7d6");
    root.style.setProperty("--theme-card-active-border", theme.cardActiveBorder || "#163300");
  }

  const header = document.getElementById("mainHeader");
  if (header) {
    header.className = `sw-header ${theme.themeClass}`;
    header.style.setProperty("--theme-bg", theme.headerBg);
    header.style.setProperty("--theme-accent", theme.pillBg);
    header.style.setProperty("--theme-text", theme.pillColor);
  }

  const pill = document.getElementById("headerActivePill");
  if (pill) {
    pill.style.background = theme.pillBg;
    pill.style.color = theme.pillColor;
  }

  const modeNameEl = document.getElementById("headerActiveModeName");
  if (modeNameEl) {
    modeNameEl.textContent = p.name;
  }

  const summaryEl = document.getElementById("headerSummaryText");
  if (summaryEl) {
    const allowedCount = p.allowedDomains ? p.allowedDomains.length : 0;
    const mutedCount = p.mutedDomains ? p.mutedDomains.length : 0;
    summaryEl.textContent = `${allowedCount} domain diizinkan • ${mutedCount} dibisukan`;
  }

  const logoIcon = document.getElementById("headerLogoIcon");
  if (logoIcon) {
    logoIcon.className = `bi ${p.icon || "bi-shield-shaded"}`;
  }
}

// --- Dynamic Search -------------------------------------------------------

function bindSearch() {
  const searchInput = document.getElementById("searchModeInput");
  const clearBtn = document.getElementById("btnClearSearch");
  if (!searchInput || !clearBtn) return;

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

// --- Mouse Swipe / Drag & Carousel Navigation -----------------------------

function bindCarouselSwipe() {
  const list = document.getElementById("profileList");
  if (!list) return;

  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let startTime = 0;
  let totalDeltaX = 0;

  // Mouse Down: Catat posisi awal, jangan set dragging sebelum mouse benar-benar digeser
  list.addEventListener("mousedown", (e) => {
    // Jangan drag jika yang diklik adalah tombol action (mata, edit, trash) atau switch
    if (e.target.closest(".sw-card-action-btn") || e.target.closest(".sw-switch")) {
      return;
    }
    isDown = true;
    hasDragged = false;
    totalDeltaX = 0;
    startX = e.pageX;
    scrollLeft = list.scrollLeft;
    startTime = Date.now();
  });

  // Mouse Leave & Mouse Up: Akhiri gesture
  const stopDrag = () => {
    if (!isDown) return;
    isDown = false;
    list.classList.remove("is-dragging");

    const elapsed = Date.now() - startTime;
    // Jika klik cepat (< 300ms) atau pergeseran kecil (<= 10px), PASTI ini adalah klik, bukan swipe!
    if (elapsed < 300 && Math.abs(totalDeltaX) <= 10) {
      hasDragged = false;
    } else if (hasDragged) {
      setTimeout(() => {
        hasDragged = false;
      }, 80);
    }
    updateCarouselNav();
  };

  list.addEventListener("mouseleave", stopDrag);
  window.addEventListener("mouseup", stopDrag);

  // Mouse Move: Hanya aktifkan mode drag jika gerakan melebihi batas ambang (threshold 10px)
  list.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    totalDeltaX = e.pageX - startX;

    if (!hasDragged && Math.abs(totalDeltaX) > 10) {
      hasDragged = true;
      list.classList.add("is-dragging");
    }

    if (hasDragged) {
      e.preventDefault();
      list.scrollLeft = scrollLeft - totalDeltaX * 1.3;
      updateCarouselNav();
    }
  });

  // Touch Screen Support (untuk touchscreen laptop / tablet)
  let touchStartX = 0;
  let touchScrollLeft = 0;
  let touchStartTime = 0;
  let touchTotalDeltaX = 0;

  list.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].pageX;
    touchScrollLeft = list.scrollLeft;
    touchStartTime = Date.now();
    touchTotalDeltaX = 0;
    hasDragged = false;
  }, { passive: true });

  list.addEventListener("touchmove", (e) => {
    touchTotalDeltaX = e.touches[0].pageX - touchStartX;
    if (!hasDragged && Math.abs(touchTotalDeltaX) > 10) {
      hasDragged = true;
    }
    if (hasDragged) {
      list.scrollLeft = touchScrollLeft - touchTotalDeltaX * 1.2;
      updateCarouselNav();
    }
  }, { passive: true });

  list.addEventListener("touchend", () => {
    const elapsed = Date.now() - touchStartTime;
    if (elapsed < 300 && Math.abs(touchTotalDeltaX) <= 10) {
      hasDragged = false;
    } else if (hasDragged) {
      setTimeout(() => {
        hasDragged = false;
      }, 80);
    }
    updateCarouselNav();
  });

  // Mouse Wheel: Scroll roda mouse vertikal otomatis menggeser kartu horizontal
  list.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      list.scrollBy({
        left: e.deltaY * 1.2,
        behavior: "smooth"
      });
      setTimeout(updateCarouselNav, 100);
    }
  }, { passive: false });

  // Tombol Panah Prev / Next Navigasi
  const prevBtn = document.getElementById("btnCarouselPrev");
  const nextBtn = document.getElementById("btnCarouselNext");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      list.scrollBy({ left: -180, behavior: "smooth" });
      setTimeout(updateCarouselNav, 220);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      list.scrollBy({ left: 180, behavior: "smooth" });
      setTimeout(updateCarouselNav, 220);
    });
  }

  list.addEventListener("scroll", updateCarouselNav);

  function updateCarouselNav() {
    if (!prevBtn || !nextBtn) return;
    const maxScroll = list.scrollWidth - list.clientWidth;
    if (maxScroll <= 2) {
      prevBtn.classList.add("sw-hidden");
      nextBtn.classList.add("sw-hidden");
      return;
    }
    prevBtn.classList.toggle("sw-hidden", list.scrollLeft <= 6);
    nextBtn.classList.toggle("sw-hidden", list.scrollLeft >= maxScroll - 6);
  }

  window.updateCarouselNav = updateCarouselNav;
  setTimeout(updateCarouselNav, 150);
}

// --- 3D Animated Activity Scenes Per Mode ---------------------------------

function getMode3dSceneHtml(p) {
  const name = (p.name || "").toLowerCase();
  const icon = (p.icon || "").toLowerCase();

  // Mode Kerja 3D Activity (Laptop 3D dengan typing code + Coffee cup dengan steam)
  if (p.id === "kerja" || name.includes("kerja") || name.includes("work") || icon.includes("briefcase") || icon.includes("laptop") || icon.includes("code")) {
    return `
      <div class="sw-3d-stage work-stage" title="Aktivitas Mode Kerja 3D">
        <div class="sw-3d-scene">
          <div class="laptop-3d">
            <div class="laptop-screen">
              <div class="screen-code">
                <span class="code-line c1"></span>
                <span class="code-line c2"></span>
                <span class="code-line c3"></span>
              </div>
            </div>
            <div class="laptop-base">
              <div class="laptop-keyboard"></div>
              <div class="laptop-trackpad"></div>
            </div>
          </div>
          <div class="cup-3d">
            <div class="cup-body"></div>
            <div class="cup-handle"></div>
            <div class="steam s1"></div>
            <div class="steam s2"></div>
          </div>
          <div class="floating-tag work-tag">&lt;/&gt;</div>
        </div>
      </div>
    `;
  }

  // Mode Belajar 3D Activity (Graduation Cap 3D dengan swinging tassel + Book Stack)
  if (p.id === "belajar" || name.includes("belajar") || name.includes("kuliah") || name.includes("study") || icon.includes("mortarboard") || icon.includes("book")) {
    return `
      <div class="sw-3d-stage study-stage" title="Aktivitas Mode Belajar 3D">
        <div class="sw-3d-scene">
          <div class="books-3d">
            <div class="book-layer b1"></div>
            <div class="book-layer b2"></div>
          </div>
          <div class="cap-3d">
            <div class="cap-diamond">
              <div class="cap-button"></div>
              <div class="cap-tassel"></div>
            </div>
            <div class="cap-skull"></div>
          </div>
          <div class="floating-sparkle"><i class="bi bi-stars"></i></div>
          <div class="floating-tag study-tag">A+</div>
        </div>
      </div>
    `;
  }

  // Mode Santai 3D Activity (Gamepad Controller 3D + Equalizer Sound Waves)
  if (p.id === "santai" || name.includes("santai") || name.includes("game") || name.includes("relax") || icon.includes("controller") || icon.includes("cup")) {
    return `
      <div class="sw-3d-stage relax-stage" title="Aktivitas Mode Santai 3D">
        <div class="sw-3d-scene">
          <div class="gamepad-3d">
            <div class="gamepad-body">
              <div class="pad-dpad"></div>
              <div class="pad-buttons">
                <span class="btn-dot d1"></span>
                <span class="btn-dot d2"></span>
              </div>
              <div class="pad-stick"></div>
            </div>
          </div>
          <div class="sound-wave-bars">
            <span class="bar bar1"></span>
            <span class="bar bar2"></span>
            <span class="bar bar3"></span>
          </div>
          <div class="floating-tag relax-tag"><i class="bi bi-music-note-beamed"></i></div>
        </div>
      </div>
    `;
  }

  // Custom / Freelance 3D Activity (Rocket Ship 3D)
  return `
    <div class="sw-3d-stage custom-stage" title="Aktivitas Mode Kustom 3D">
      <div class="sw-3d-scene">
        <div class="rocket-3d">
          <div class="rocket-body">
            <div class="rocket-window"></div>
            <div class="rocket-fin left"></div>
            <div class="rocket-fin right"></div>
          </div>
          <div class="rocket-flame"></div>
        </div>
        <div class="floating-sparkle"><i class="bi bi-lightning-charge-fill"></i></div>
        <div class="floating-tag custom-tag">PRO</div>
      </div>
    </div>
  `;
}

// --- Horizontal Mode List ("kekanan", Kompak & 3D Animasi) ----------------

function renderProfiles() {
  const list = document.getElementById("profileList");
  if (!list) return;
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
    const theme = getModeTheme(p);
    card.className = "sw-profile-card" + (isActive ? " active" : "") + ` ${theme.themeClass}`;

    const allowedLabel = p.allowedDomains && p.allowedDomains.length
      ? `${p.allowedDomains.length} Izinkan`
      : "Bebas";

    const mutedLabel = p.mutedDomains && p.mutedDomains.length
      ? `${p.mutedDomains.length} Muted`
      : "No Mute";

    card.innerHTML = `
      <div class="sw-card-top">
        <div class="sw-card-icon-mini">
          <i class="bi ${p.icon}"></i>
        </div>
        <div class="sw-card-title-wrap">
          <div class="sw-card-name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
          <div class="sw-card-status-label">${isActive ? '<i class="bi bi-check2-circle"></i> Aktif' : 'Klik aktifkan'}</div>
        </div>
        <div class="sw-switch ${isActive ? "on" : ""}" data-id="${p.id}" title="Toggle aktifkan mode"></div>
      </div>

      ${getMode3dSceneHtml(p)}

      <div class="sw-card-badges">
        <div class="sw-card-badge-row allowed" title="${(p.allowedDomains || []).join(', ')}">
          <i class="bi bi-check2"></i>
          <span>${allowedLabel}</span>
        </div>
        <div class="sw-card-badge-row muted" title="${(p.mutedDomains || []).join(', ')}">
          <i class="bi bi-volume-mute"></i>
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
    const switchBtn = card.querySelector(".sw-switch");
    if (switchBtn) {
      switchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        activateProfile(p.id);
      });
    }

    // Klik tombol mata (Detail aturan)
    const eyeBtn = card.querySelector(".sw-btn-eye");
    if (eyeBtn) {
      eyeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openDetailModal(p.id);
      });
    }

    // Klik tombol edit
    const editBtn = card.querySelector(".sw-btn-edit");
    if (editBtn) {
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openEditModal(p.id);
      });
    }

    // Klik tombol trash
    const trashBtn = card.querySelector(".sw-btn-trash");
    if (trashBtn) {
      trashBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (state.profiles.length <= 1) {
          alert("Minimal harus ada satu profil ruang kerja.");
          return;
        }
        if (confirm(`Hapus mode "${p.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
          deleteProfile(p.id);
        }
      });
    }

    // Klik card untuk mengaktifkan dengan efek 3D ditekan (tactile feedback)
    card.addEventListener("click", () => {
      // Jika pengguna baru saja melakukan swipe/drag mouse, batalkan aktivasi kartu
      if (hasDragged) return;
      activateProfile(p.id);
    });

    list.appendChild(card);
  });

  if (typeof window.updateCarouselNav === "function") {
    setTimeout(window.updateCarouselNav, 100);
  }
}

async function activateProfile(id) {
  save({ activeProfileId: id });
  renderActiveHeader();
  renderProfiles();
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({ type: "ACTIVATE_PROFILE", profileId: id }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }
}

function deleteProfile(id) {
  const profiles = state.profiles.filter((p) => p.id !== id);
  const activeProfileId = state.activeProfileId === id ? (profiles[0] && profiles[0].id) : state.activeProfileId;
  save({ profiles, activeProfileId });
  renderActiveHeader();
  renderProfiles();
  if (state.activeProfileId && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      chrome.runtime.sendMessage({ type: "ACTIVATE_PROFILE", profileId: state.activeProfileId }, () => {
        if (chrome.runtime.lastError) {}
      });
    } catch (e) {}
  }
}

// --- Detail Modal (Allowed & Disallowed) -----------------------------------

function openDetailModal(profileId) {
  const p = state.profiles.find((x) => x.id === profileId);
  if (!p) return;
  currentDetailProfileId = profileId;

  const iconEl = document.getElementById("detailIcon");
  if (iconEl) iconEl.className = `bi ${p.icon}`;

  const nameEl = document.getElementById("detailName");
  if (nameEl) nameEl.textContent = p.name;

  // Render Allowed
  const allowedEl = document.getElementById("detailAllowed");
  if (allowedEl) {
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
  }

  // Render Muted
  const mutedEl = document.getElementById("detailMuted");
  if (mutedEl) {
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
  }

  const modal = document.getElementById("modalDetailMode");
  if (modal) modal.classList.remove("sw-hidden");
}

function closeDetailModal() {
  const modal = document.getElementById("modalDetailMode");
  if (modal) modal.classList.add("sw-hidden");
}

// --- Edit & Tambah Mode Modal ---------------------------------------------

function setupIconSelector(selectedIcon) {
  const container = document.getElementById("iconSelector");
  if (!container) return;
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
      if (inputIcon) inputIcon.value = ic;
    });
    container.appendChild(btn);
  });
}

// --- Domain Suggestion Helpers --------------------------------------------

function parseDomainList(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map(s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
    .filter(Boolean);
}

function updateDomainCounter(badgeId, count) {
  const badge = document.getElementById(badgeId);
  if (badge) {
    badge.textContent = `${count} domain`;
  }
}

function syncSuggestionChips(containerId, textareaId, isMuted = false) {
  const container = document.getElementById(containerId);
  const textarea = document.getElementById(textareaId);
  if (!container || !textarea) return;

  const currentDomains = parseDomainList(textarea.value);
  const counterId = isMuted ? "mutedCountBadge" : "allowedCountBadge";
  updateDomainCounter(counterId, currentDomains.length);

  const chips = container.querySelectorAll(".sw-suggest-chip");
  chips.forEach((chip) => {
    const d = chip.dataset.domain;
    const isSelected = currentDomains.includes(d);
    if (isMuted) {
      chip.classList.toggle("selected-muted", isSelected);
    } else {
      chip.classList.toggle("selected", isSelected);
    }
    const checkIcon = chip.querySelector(".chip-check");
    if (checkIcon) {
      checkIcon.className = isSelected ? "bi bi-check2 chip-check" : "bi bi-plus chip-check";
    }
  });
}

function toggleDomainInTextarea(textareaId, domain, containerId, isMuted = false) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  let domains = parseDomainList(textarea.value);
  const norm = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");

  if (domains.includes(norm)) {
    domains = domains.filter(d => d !== norm);
  } else {
    domains.push(norm);
  }

  textarea.value = domains.join(", ");
  syncSuggestionChips(containerId, textareaId, isMuted);
}

function renderSuggestionChips(containerId, textareaId, presets, isMuted = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  presets.forEach((item) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sw-suggest-chip";
    chip.dataset.domain = item.domain;
    chip.innerHTML = `<i class="bi ${item.icon || 'bi-globe'}"></i> <span>${escapeHtml(item.domain)}</span> <i class="bi bi-plus chip-check"></i>`;
    chip.addEventListener("click", () => {
      toggleDomainInTextarea(textareaId, item.domain, containerId, isMuted);
    });
    container.appendChild(chip);
  });

  syncSuggestionChips(containerId, textareaId, isMuted);
}

async function fetchOpenTabsSuggestions(textareaId, containerId, isMuted = false) {
  if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({});
      const textarea = document.getElementById(textareaId);
      const currentDomains = parseDomainList(textarea ? textarea.value : "");
      let addedAny = false;

      tabs.forEach((tab) => {
        if (!tab.url) return;
        try {
          const u = new URL(tab.url);
          if (u.protocol.startsWith("http")) {
            const host = u.hostname.replace(/^www\./, "").toLowerCase();
            if (host && !host.includes("chrome") && !currentDomains.includes(host)) {
              currentDomains.push(host);
              addedAny = true;
            }
          }
        } catch (e) {}
      });

      if (addedAny && textarea) {
        textarea.value = currentDomains.join(", ");
        syncSuggestionChips(containerId, textareaId, isMuted);
      }
    } catch (err) {
      console.warn("Failed to fetch open tabs:", err);
    }
  }
}

function openEditModal(profileId = null) {
  const modal = document.getElementById("modalEditMode");
  const heading = document.getElementById("editModalTitle");
  const inputId = document.getElementById("editModeId");
  const inputName = document.getElementById("inputEditName");
  const inputIcon = document.getElementById("inputEditIcon");
  const inputAllowed = document.getElementById("inputEditAllowed");
  const inputMuted = document.getElementById("inputEditMuted");

  if (!modal) return;

  if (profileId) {
    const p = state.profiles.find((x) => x.id === profileId);
    if (!p) return;
    if (heading) heading.textContent = `Edit: ${p.name}`;
    if (inputId) inputId.value = p.id;
    if (inputName) inputName.value = p.name;
    if (inputIcon) inputIcon.value = p.icon;
    if (inputAllowed) inputAllowed.value = (p.allowedDomains || []).join(", ");
    if (inputMuted) inputMuted.value = (p.mutedDomains || []).join(", ");
    setupIconSelector(p.icon);
  } else {
    if (heading) heading.textContent = "Tambah Mode Baru";
    if (inputId) inputId.value = "";
    if (inputName) inputName.value = "";
    if (inputIcon) inputIcon.value = "bi-briefcase-fill";
    if (inputAllowed) inputAllowed.value = "";
    if (inputMuted) inputMuted.value = "";
    setupIconSelector("bi-briefcase-fill");
  }

  // Render & Hubungkan Suggestion Chips
  renderSuggestionChips("suggestionsAllowed", "inputEditAllowed", POPULAR_ALLOWED_SUGGESTIONS, false);
  renderSuggestionChips("suggestionsMuted", "inputEditMuted", POPULAR_MUTED_SUGGESTIONS, true);

  if (inputAllowed) {
    inputAllowed.oninput = () => syncSuggestionChips("suggestionsAllowed", "inputEditAllowed", false);
  }
  if (inputMuted) {
    inputMuted.oninput = () => syncSuggestionChips("suggestionsMuted", "inputEditMuted", true);
  }

  closeDetailModal();
  modal.classList.remove("sw-hidden");
  if (inputName) inputName.focus();
}

function closeEditModal() {
  const modal = document.getElementById("modalEditMode");
  if (modal) modal.classList.add("sw-hidden");
}

function bindModals() {
  // Detail Modal Events
  const btnCloseDetail = document.getElementById("btnCloseDetail");
  const btnCloseDetailBottom = document.getElementById("btnCloseDetailBottom");
  const backdropDetail = document.getElementById("backdropDetail");
  const btnEditFromDetail = document.getElementById("btnEditFromDetail");

  if (btnCloseDetail) btnCloseDetail.addEventListener("click", closeDetailModal);
  if (btnCloseDetailBottom) btnCloseDetailBottom.addEventListener("click", closeDetailModal);
  if (backdropDetail) backdropDetail.addEventListener("click", closeDetailModal);

  if (btnEditFromDetail) {
    btnEditFromDetail.addEventListener("click", () => {
      if (currentDetailProfileId) {
        openEditModal(currentDetailProfileId);
      }
    });
  }

  // Edit Modal Events
  const btnCloseEdit = document.getElementById("btnCloseEdit");
  const btnCancelEdit = document.getElementById("btnCancelEdit");
  const backdropEdit = document.getElementById("backdropEdit");
  const btnAddProfile = document.getElementById("btnAddProfile");
  const formEditMode = document.getElementById("formEditMode");

  if (btnCloseEdit) btnCloseEdit.addEventListener("click", closeEditModal);
  if (btnCancelEdit) btnCancelEdit.addEventListener("click", closeEditModal);
  if (backdropEdit) backdropEdit.addEventListener("click", closeEditModal);

  const btnSuggestTabsAllowed = document.getElementById("btnSuggestOpenTabsAllowed");
  if (btnSuggestTabsAllowed) {
    btnSuggestTabsAllowed.addEventListener("click", () => {
      fetchOpenTabsSuggestions("inputEditAllowed", "suggestionsAllowed", false);
    });
  }

  const btnSuggestTabsMuted = document.getElementById("btnSuggestOpenTabsMuted");
  if (btnSuggestTabsMuted) {
    btnSuggestTabsMuted.addEventListener("click", () => {
      fetchOpenTabsSuggestions("inputEditMuted", "suggestionsMuted", true);
    });
  }

  if (btnAddProfile) {
    btnAddProfile.addEventListener("click", () => {
      openEditModal(null);
    });
  }

  if (formEditMode) {
    formEditMode.addEventListener("submit", (e) => {
      e.preventDefault();
      const idEl = document.getElementById("editModeId");
      const nameEl = document.getElementById("inputEditName");
      const iconEl = document.getElementById("inputEditIcon");
      const allowedEl = document.getElementById("inputEditAllowed");
      const mutedEl = document.getElementById("inputEditMuted");

      const id = idEl ? idEl.value : "";
      const name = nameEl ? nameEl.value.trim() : "";
      const icon = (iconEl && iconEl.value) || "bi-briefcase-fill";
      const allowedRaw = allowedEl ? allowedEl.value : "";
      const mutedRaw = mutedEl ? mutedEl.value : "";

      if (!name) return;
      const allowedDomains = parseDomainList(allowedRaw);
      const mutedDomains = parseDomainList(mutedRaw);

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
          activateProfile(id);
        }
      } else {
        // Mode Baru
        const newProfile = {
          id: "m" + Date.now(),
          name,
          icon,
          color: "custom",
          allowedDomains,
          mutedDomains
        };
        const profiles = [...state.profiles, newProfile];
        save({ profiles });
      }

      renderActiveHeader();
      renderProfiles();
      closeEditModal();
    });
  }
}

// --- Compact Circular Battery Memory Bar (Top) ---------------------------

function renderStorageUsage() {
  const textEl = document.getElementById("storageText");
  const circle = document.getElementById("batteryCircle");
  const pctEl = document.getElementById("batteryPct");
  const badge = document.getElementById("storageBadge");

  if (!chrome || !chrome.storage || !chrome.storage.local || !chrome.storage.local.getBytesInUse) {
    if (textEl) textEl.textContent = "0 KB / 10 MB terpakai";
    return;
  }
  chrome.storage.local.getBytesInUse(null, (bytes) => {
    const kb = (bytes || 0) / 1024;
    const mb = (bytes || 0) / (1024 * 1024);
    const text = kb < 1024 ? `${kb.toFixed(1)} KB` : `${mb.toFixed(2)} MB`;
    if (textEl) textEl.textContent = `${text} / 10 MB terpakai`;

    const pct = Math.min(100, Math.max(0, ((bytes || 0) / STORAGE_LIMIT_BYTES) * 100));
    if (circle) {
      circle.style.setProperty("--mem-pct", `${pct.toFixed(1)}%`);
      circle.classList.remove("warning", "danger");
    }

    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;

    if (badge) {
      badge.classList.remove("safe", "warning", "danger");

      if (pct < 70) {
        badge.textContent = "Aman";
        badge.classList.add("safe");
      } else if (pct < 90) {
        badge.textContent = "Waspada";
        badge.classList.add("warning");
        if (circle) circle.classList.add("warning");
      } else {
        badge.textContent = "Penuh";
        badge.classList.add("danger");
        if (circle) circle.classList.add("danger");
      }
    }
  });
}

function bindClearData() {
  const btn = document.getElementById("btnClearData");
  if (!btn) return;

  btn.addEventListener("click", () => {
    const ok = confirm(
      "Hapus SEMUA data lokal ekstensi ini?\n\nProfil, kata kunci kustom, nama panggilan, dan log audit akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
    );
    if (!ok) return;

    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
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
          renderActiveHeader();
          renderProfiles();
          renderKeywords();
          renderDetectorToggles();
          renderStorageUsage();
        });
      });
    } else {
      state.profiles = DEFAULT_PROFILES;
      state.activeProfileId = DEFAULT_PROFILES[0].id;
      state.customKeywords = [];
      state.auditLog = [];
      state.settings = DEFAULT_SETTINGS;
      state.nickname = "Pengguna";
      renderNickname();
      renderActiveHeader();
      renderProfiles();
      renderKeywords();
      renderDetectorToggles();
      renderStorageUsage();
    }
  });
}

// --- Forms & Nav ----------------------------------------------------------

function bindForms() {
  const kwForm = document.getElementById("keywordForm");
  if (kwForm) {
    kwForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = document.getElementById("keywordTerm");
      if (!input) return;
      const term = input.value.trim();
      if (!term) return;
      const customKeywords = [...state.customKeywords, { id: "k" + Date.now(), term, label: term }];
      save({ customKeywords });
      input.value = "";
      renderKeywords();
    });
  }

  ["detNik", "detEmail", "detApikey", "detCard"].forEach((id) => {
    const chk = document.getElementById(id);
    if (chk) {
      chk.addEventListener("change", () => {
        const settings = {
          nik: document.getElementById("detNik")?.checked ?? true,
          email: document.getElementById("detEmail")?.checked ?? true,
          apikey: document.getElementById("detApikey")?.checked ?? true,
          card: document.getElementById("detCard")?.checked ?? true,
          keywords: true
        };
        save({ settings });
      });
    }
  });

  const btnDashboard = document.getElementById("btnDashboard");
  if (btnDashboard) {
    btnDashboard.addEventListener("click", () => {
      if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      } else {
        window.open("dashboard.html", "_blank");
      }
    });
  }

  bindClearData();
}

function renderKeywords() {
  const list = document.getElementById("keywordList");
  if (!list) return;
  list.innerHTML = "";
  if (!state.customKeywords.length) {
    list.innerHTML = `<div class="sw-hint">Belum ada kata kunci kustom.</div>`;
    return;
  }
  state.customKeywords.forEach((kw) => {
    const row = document.createElement("div");
    row.className = "sw-keyword-item";
    row.innerHTML = `<span><i class="bi bi-tag-fill" style="margin-right:6px; color:var(--wise-dark);"></i>${escapeHtml(kw.term)}</span><button data-id="${kw.id}"><i class="bi bi-trash3"></i></button>`;
    const delBtn = row.querySelector("button");
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        const customKeywords = state.customKeywords.filter((x) => x.id !== kw.id);
        save({ customKeywords });
        renderKeywords();
      });
    }
    list.appendChild(row);
  });
}

function renderDetectorToggles() {
  const nik = document.getElementById("detNik");
  const email = document.getElementById("detEmail");
  const apikey = document.getElementById("detApikey");
  const card = document.getElementById("detCard");
  if (nik) nik.checked = state.settings.nik !== false;
  if (email) email.checked = state.settings.email !== false;
  if (apikey) apikey.checked = state.settings.apikey !== false;
  if (card) card.checked = state.settings.card !== false;
}

function bindNav() {
  const navItems = document.querySelectorAll(".sw-nav-item[data-view]");
  navItems.forEach((btn) => {
    btn.addEventListener("click", () => {
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".sw-view").forEach((v) => v.classList.add("sw-hidden"));
      const view = document.getElementById(btn.dataset.view);
      if (view) view.classList.remove("sw-hidden");
    });
  });
}
