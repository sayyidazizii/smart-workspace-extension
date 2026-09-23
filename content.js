/**
 * Content Script — Smart Workspace Extension
 * Berjalan di halaman platform AI publik (ChatGPT, Claude, Gemini).
 * Memindai kolom input secara real-time dan menahan pengiriman jika
 * ditemukan data sensitif, sampai pengguna memilih tindakan.
 */

(function () {
  const HOST = location.hostname.replace(/^www\./, "");

  // Selector kolom input & tombol kirim per situs. Diberi fallback generik
  // karena struktur DOM platform AI publik sering berubah.
  const SITE_CONFIG = {
    "chat.openai.com": {
      input: "#prompt-textarea, div[contenteditable='true']",
      sendButton: "button[data-testid='send-button'], button[aria-label*='Send' i]"
    },
    "chatgpt.com": {
      input: "#prompt-textarea, div[contenteditable='true']",
      sendButton: "button[data-testid='send-button'], button[aria-label*='Send' i]"
    },
    "claude.ai": {
      input: "div[contenteditable='true'].ProseMirror, div[contenteditable='true']",
      sendButton: "button[aria-label*='Send' i]"
    },
    "gemini.google.com": {
      input: "div[contenteditable='true'].ql-editor, div[contenteditable='true']",
      sendButton: "button[aria-label*='Send' i], button[aria-label*='Kirim' i]"
    }
  };

  const config = SITE_CONFIG[HOST] || {
    input: "textarea, div[contenteditable='true']",
    sendButton: "button[aria-label*='Send' i], button[type='submit']"
  };

  let customKeywords = [];
  let settings = { nik: true, email: true, apikey: true, card: true, keywords: true };
  let activeProfileId = null;

  function loadState() {
    chrome.storage.local.get(["customKeywords", "settings", "activeProfileId"], (data) => {
      customKeywords = data.customKeywords || [];
      settings = data.settings || settings;
      activeProfileId = data.activeProfileId || null;
    });
  }
  loadState();
  chrome.storage.onChanged.addListener(() => loadState());

  function getInputElement() {
    const el = document.querySelector(config.input);
    return el;
  }

  function getText(el) {
    if (!el) return "";
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") return el.value || "";
    return el.innerText || el.textContent || "";
  }

  function setText(el, text) {
    if (!el) return;
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      // contenteditable (React/ProseMirror-controlled)
      el.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
  }

  function triggerSend(el) {
    // Coba klik tombol kirim dulu; jika tidak ada, simulasikan Enter.
    const btn = document.querySelector(config.sendButton);
    if (btn && !btn.disabled) {
      btn.click();
      return;
    }
    el.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
    );
  }

  function logAuditEvent(action, findings) {
    chrome.runtime.sendMessage({
      type: "LOG_AUDIT_EVENT",
      domain: HOST,
      action, // "sanitized" | "override"
      items: findings.map((f) => ({ type: f.type, label: f.label, count: f.count })),
      profileId: activeProfileId
    });
  }

  // --- Popover konfirmasi ---------------------------------------------------

  let popoverEl = null;
  let pendingBypassText = null; // teks yang sudah "disetujui apa adanya" agar tidak scan ulang

  function removePopover() {
    if (popoverEl) {
      popoverEl.remove();
      popoverEl = null;
    }
  }

  function showPopover(el, findings, onSanitize, onOverride) {
    removePopover();

    const box = document.createElement("div");
    box.className = "sw-popover";

    const header = document.createElement("div");
    header.className = "sw-popover-header";
    header.innerHTML = `
      <span class="sw-popover-icon">!</span>
      <div>
        <div class="sw-popover-title">Data Sensitif Terdeteksi</div>
        <div class="sw-popover-subtitle">${findings.length} item berisiko ditemukan sebelum kirim</div>
      </div>`;
    box.appendChild(header);

    const list = document.createElement("div");
    list.className = "sw-popover-list";
    findings.forEach((f) => {
      const row = document.createElement("div");
      row.className = "sw-popover-row";
      row.innerHTML = `<span class="sw-row-type">${f.label}</span><span class="sw-row-arrow">${f.count}× &rarr; ${f.token}</span>`;
      list.appendChild(row);
    });
    box.appendChild(list);

    const actions = document.createElement("div");
    actions.className = "sw-popover-actions";

    const btnSanitize = document.createElement("button");
    btnSanitize.className = "sw-btn sw-btn-primary";
    btnSanitize.textContent = "Kirim dengan Samaran";
    btnSanitize.onclick = () => {
      removePopover();
      onSanitize();
    };

    const btnOverride = document.createElement("button");
    btnOverride.className = "sw-btn sw-btn-secondary";
    btnOverride.textContent = "Tetap Kirim Asli";
    btnOverride.onclick = () => {
      removePopover();
      onOverride();
    };

    actions.appendChild(btnSanitize);
    actions.appendChild(btnOverride);
    box.appendChild(actions);

    document.body.appendChild(box);
    popoverEl = box;

    const rect = el.getBoundingClientRect();
    box.style.left = `${Math.max(12, rect.left)}px`;
    box.style.top = `${Math.max(12, rect.top - box.offsetHeight - 12)}px`;
  }

  // --- Intersepsi pengiriman -------------------------------------------------

  function handleAttemptedSend(el, event) {
    const text = getText(el);
    if (!text || !text.trim()) return;
    if (pendingBypassText === text) {
      // Pengguna sudah memilih "Tetap Kirim Asli" untuk teks persis ini
      pendingBypassText = null;
      return; // biarkan lolos
    }

    const result = SWSanitizer.scan(text, customKeywords, settings);
    if (!result.hasSensitive) return; // aman, biarkan lolos

    // Tahan pengiriman
    event.preventDefault();
    event.stopImmediatePropagation();

    showPopover(
      el,
      result.findings,
      () => {
        setText(el, result.sanitized);
        logAuditEvent("sanitized", result.findings);
        setTimeout(() => triggerSend(el), 50);
      },
      () => {
        pendingBypassText = text;
        logAuditEvent("override", result.findings);
        setTimeout(() => triggerSend(el), 0);
      }
    );
  }

  function attach() {
    const el = getInputElement();
    if (!el || el.dataset.swAttached) return;
    el.dataset.swAttached = "true";

    el.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          handleAttemptedSend(el, e);
        }
      },
      true
    );

    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest(config.sendButton);
        if (btn) {
          const inputEl = getInputElement();
          if (inputEl) handleAttemptedSend(inputEl, e);
        }
      },
      true
    );
  }

  // Platform AI umumnya SPA — input bisa muncul belakangan, pantau terus.
  attach();
  const observer = new MutationObserver(() => attach());
  observer.observe(document.body, { childList: true, subtree: true });
})();
