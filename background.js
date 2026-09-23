/**
 * Service Worker — Smart Workspace Extension
 * Mengelola profil ruang kerja, status tab (mute/group), dan audit log lokal.
 */

const DEFAULT_PROFILES = [
  {
    id: "kerja",
    name: "Mode Kerja",
    icon: "💼",
    color: "purple",
    allowedDomains: ["slack.com", "trello.com", "mail.google.com"],
    mutedDomains: ["youtube.com", "instagram.com", "tiktok.com"]
  },
  {
    id: "belajar",
    name: "Mode Belajar/Kuliah",
    icon: "📚",
    color: "blue",
    allowedDomains: ["elearning.ut.ac.id", "zoom.us", "docs.google.com"],
    mutedDomains: ["youtube.com", "instagram.com", "tiktok.com", "slack.com"]
  },
  {
    id: "santai",
    name: "Mode Santai",
    icon: "🎮",
    color: "green",
    allowedDomains: [],
    mutedDomains: []
  }
];

const DEFAULT_SETTINGS = {
  nik: true,
  email: true,
  apikey: true,
  card: true,
  keywords: true
};

async function initStorage() {
  const data = await chrome.storage.local.get([
    "profiles",
    "activeProfileId",
    "customKeywords",
    "auditLog",
    "settings",
    "nickname"
  ]);

  const patch = {};
  if (!data.profiles) patch.profiles = DEFAULT_PROFILES;
  if (!data.activeProfileId) patch.activeProfileId = DEFAULT_PROFILES[0].id;
  if (!data.customKeywords) patch.customKeywords = [];
  if (!data.auditLog) patch.auditLog = [];
  if (!data.settings) patch.settings = DEFAULT_SETTINGS;
  if (!data.nickname) patch.nickname = "Pengguna";

  if (Object.keys(patch).length) {
    await chrome.storage.local.set(patch);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initStorage();
});
chrome.runtime.onStartup.addListener(() => {
  initStorage();
});

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (e) {
    return "";
  }
}

/**
 * Menerapkan profil aktif ke seluruh tab yang sedang terbuka:
 * - Tab di domain "dibisukan" (mutedDomains) -> audio dimatikan.
 * - Tab di luar domain "diizinkan" (allowedDomains) -> dikelompokkan &
 *   dikolaps ke grup "Lainnya" supaya tidak mengganggu fokus (jika allowedDomains diisi).
 */
async function applyProfile(profileId) {
  const { profiles } = await chrome.storage.local.get("profiles");
  const profile = (profiles || []).find((p) => p.id === profileId);
  if (!profile) return;

  const tabs = await chrome.tabs.query({});
  const idsToCollapse = [];

  for (const tab of tabs) {
    if (!tab.url || !tab.id) continue;
    const domain = domainOf(tab.url);
    if (!domain) continue;

    // Mute/unmute
    const shouldMute = profile.mutedDomains.some((d) => domain.endsWith(d));
    try {
      if (tab.mutedInfo?.muted !== shouldMute) {
        await chrome.tabs.update(tab.id, { muted: shouldMute });
      }
    } catch (e) {
      /* tab mungkin sudah tertutup */
    }

    // Kumpulkan tab di luar domain yang diizinkan (hanya jika allowedDomains tidak kosong)
    if (profile.allowedDomains && profile.allowedDomains.length > 0) {
      const isAllowed = profile.allowedDomains.some((d) => domain.endsWith(d));
      if (!isAllowed) idsToCollapse.push(tab.id);
    }
  }

  // Kelompokkan tab di luar konteks ke grup "Lainnya" yang dikolaps, jika API tersedia
  if (idsToCollapse.length > 0 && chrome.tabGroups) {
    try {
      const groupId = await chrome.tabs.group({ tabIds: idsToCollapse });
      await chrome.tabGroups.update(groupId, {
        title: "Lainnya",
        collapsed: true,
        color: "grey"
      });
    } catch (e) {
      /* grouping bisa gagal di beberapa kondisi (mis. tab pinned) — abaikan dengan aman */
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ACTIVATE_PROFILE") {
    chrome.storage.local.set({ activeProfileId: message.profileId }).then(() => {
      applyProfile(message.profileId).finally(() => sendResponse({ ok: true }));
    });
    return true; // async response
  }

  if (message.type === "LOG_AUDIT_EVENT") {
    chrome.storage.local.get(["auditLog"]).then(({ auditLog }) => {
      const log = auditLog || [];
      log.unshift({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: Date.now(),
        domain: message.domain,
        action: message.action, // "sanitized" | "override"
        items: message.items || [],
        profileId: message.profileId || null
      });
      // Batasi ukuran log agar storage tidak membengkak
      const trimmed = log.slice(0, 1000);
      chrome.storage.local.set({ auditLog: trimmed }).then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});
