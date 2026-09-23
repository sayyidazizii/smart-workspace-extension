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

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function logAuditEvent(action, result) {
    const findings = result.findings || [];
    const snippet = result.originalText
      ? (result.originalText.length > 200 ? result.originalText.slice(0, 200) + "..." : result.originalText)
      : "";

    chrome.runtime.sendMessage({
      type: "LOG_AUDIT_EVENT",
      domain: HOST,
      action, // "sanitized" | "override"
      items: findings.map((f) => ({
        type: f.type,
        label: f.label,
        count: f.count,
        sample: f.sample || "",
        samples: f.samples || (f.sample ? [f.sample] : []),
        token: f.token
      })),
      snippet,
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

  function showPopover(el, scanResult, onSanitize, onOverride) {
    removePopover();

    const findings = scanResult.findings || [];
    const totalCount = scanResult.totalCount || findings.reduce((s, f) => s + (f.count || 1), 0);

    const box = document.createElement("div");
    box.className = "sw-popover";

    const header = document.createElement("div");
    header.className = "sw-popover-header";
    header.innerHTML = `
      <span class="sw-popover-icon"><i class="bi bi-shield-exclamation"></i></span>
      <div class="sw-popover-header-text">
        <div class="sw-popover-title">Potensi Kebocoran Data Terdeteksi</div>
        <div class="sw-popover-subtitle">${totalCount} data sensitif dicegat sebelum terkirim ke platform AI</div>
      </div>`;
    box.appendChild(header);

    const list = document.createElement("div");
    list.className = "sw-popover-list";

    findings.forEach((f) => {
      const row = document.createElement("div");
      row.className = "sw-popover-row";

      const samplesList = (f.samples && f.samples.length) ? f.samples.join(", ") : (f.sample || "-");

      row.innerHTML = `
        <div class="sw-row-main">
          <span class="sw-row-type"><i class="bi bi-exclamation-circle-fill"></i> ${escapeHtml(f.label)} (${f.count}x)</span>
          <span class="sw-row-arrow">&rarr; ${escapeHtml(f.token)}</span>
        </div>
        <div class="sw-row-detail">
          <span class="sw-detail-label">Data bocor:</span>
          <code class="sw-leak-code">${escapeHtml(samplesList)}</code>
        </div>
      `;
      list.appendChild(row);
    });
    box.appendChild(list);

    // Toggle Preview sanitized text
    const previewContainer = document.createElement("div");
    previewContainer.className = "sw-popover-preview-container";
    previewContainer.innerHTML = `
      <button type="button" class="sw-toggle-preview-btn">
        <i class="bi bi-eye"></i> Lihat Teks Tersensor
      </button>
      <div class="sw-preview-box sw-hidden">
        <div class="sw-preview-label">Teks yang akan dikirim (Data sensitif diganti token aman):</div>
        <div class="sw-preview-text">${escapeHtml(scanResult.sanitized || "")}</div>
      </div>
    `;

    const toggleBtn = previewContainer.querySelector(".sw-toggle-preview-btn");
    const previewBox = previewContainer.querySelector(".sw-preview-box");
    toggleBtn.addEventListener("click", () => {
      previewBox.classList.toggle("sw-hidden");
      const isShowing = !previewBox.classList.contains("sw-hidden");
      toggleBtn.innerHTML = isShowing
        ? `<i class="bi bi-eye-slash"></i> Sembunyikan Teks Tersensor`
        : `<i class="bi bi-eye"></i> Lihat Teks Tersensor`;
    });
    box.appendChild(previewContainer);

    const actions = document.createElement("div");
    actions.className = "sw-popover-actions";

    const btnSanitize = document.createElement("button");
    btnSanitize.className = "sw-btn sw-btn-primary";
    btnSanitize.innerHTML = `<i class="bi bi-shield-check"></i> Kirim dengan Samaran`;
    btnSanitize.onclick = () => {
      removePopover();
      onSanitize();
    };

    const btnOverride = document.createElement("button");
    btnOverride.className = "sw-btn sw-btn-secondary";
    btnOverride.innerHTML = `<i class="bi bi-send-exclamation"></i> Tetap Kirim Asli`;
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
      result,
      () => {
        setText(el, result.sanitized);
        logAuditEvent("sanitized", result);
        setTimeout(() => triggerSend(el), 50);
      },
      () => {
        pendingBypassText = text;
        logAuditEvent("override", result);
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
