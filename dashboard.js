document.addEventListener("DOMContentLoaded", init);

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
let fullAuditLog = [];
let logSearchQuery = "";

async function init() {
  const { auditLog } = await chrome.storage.local.get(["auditLog"]);
  fullAuditLog = auditLog || [];

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = fullAuditLog.filter((e) => now - e.ts <= weekMs);
  const lastWeek = fullAuditLog.filter((e) => now - e.ts > weekMs && now - e.ts <= weekMs * 2);

  renderScore(thisWeek, lastWeek);
  renderTotals(thisWeek);
  renderTopType(thisWeek);
  renderRatio(thisWeek);
  renderWeekChart(thisWeek);
  renderLogList();

  // Search input for logs
  const searchInput = document.getElementById("inputSearchLog");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      logSearchQuery = e.target.value.trim().toLowerCase();
      renderLogList();
    });
  }

  document.getElementById("btnExportCsv").addEventListener("click", () => exportLog(fullAuditLog, "csv"));
  document.getElementById("btnExportJson").addEventListener("click", () => exportLog(fullAuditLog, "json"));
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

function computeScore(entries) {
  if (!entries.length) return 100;
  const sanitized = entries.filter((e) => e.action === "sanitized").length;
  return Math.round((sanitized / entries.length) * 100);
}

function renderScore(thisWeek, lastWeek) {
  const score = computeScore(thisWeek);
  const prevScore = computeScore(lastWeek);
  const circumference = 2 * Math.PI * 56;
  const arc = document.getElementById("scoreArc");
  arc.setAttribute("stroke-dasharray", `${circumference}`);
  arc.setAttribute("stroke-dashoffset", `${circumference * (1 - score / 100)}`);
  document.getElementById("scoreNum").textContent = score;

  const diff = score - prevScore;
  const trendEl = document.getElementById("scoreTrend");
  if (thisWeek.length === 0 && lastWeek.length === 0) {
    trendEl.innerHTML = `<i class="bi bi-dash"></i> Belum ada data minggu ini`;
    trendEl.style.color = "#8a8fa3";
  } else if (diff >= 0) {
    trendEl.innerHTML = `<i class="bi bi-arrow-up-right"></i> Naik ${diff} poin minggu ini`;
    trendEl.style.color = "#16a34a";
  } else {
    trendEl.innerHTML = `<i class="bi bi-arrow-down-right"></i> Turun ${Math.abs(diff)} poin minggu ini`;
    trendEl.style.color = "#dc2626";
  }
}

function renderTotals(thisWeek) {
  document.getElementById("totalBlocked").textContent = thisWeek.length;
}

function renderTopType(thisWeek) {
  const counts = {};
  thisWeek.forEach((e) => {
    (e.items || []).forEach((it) => {
      counts[it.label] = (counts[it.label] || 0) + (it.count || 1);
    });
  });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    document.getElementById("topType").textContent = "-";
    document.getElementById("topTypeSub").textContent = "Belum ada kejadian";
    return;
  }
  const [label, count] = entries[0];
  const total = entries.reduce((s, [, c]) => s + c, 0);
  document.getElementById("topType").textContent = label;
  document.getElementById("topTypeSub").textContent = `${count} dari ${total} data dicegat`;
}

function renderRatio(thisWeek) {
  const total = thisWeek.length;
  const sanitized = thisWeek.filter((e) => e.action === "sanitized").length;
  const pct = total ? Math.round((sanitized / total) * 100) : 0;
  document.getElementById("ratioFill").style.width = pct + "%";
  document.getElementById("ratioSanitizedLabel").innerHTML = `<i class="bi bi-shield-check text-success"></i> Disamarkan ${pct}%`;
  document.getElementById("ratioOverrideLabel").innerHTML = `<i class="bi bi-send-exclamation text-danger"></i> Dikirim asli ${100 - pct}%`;
}

function renderWeekChart(thisWeek) {
  const counts = [0, 0, 0, 0, 0, 0, 0]; // Sen..Min
  thisWeek.forEach((e) => {
    const d = new Date(e.ts);
    const jsDay = d.getDay(); // 0=Min..6=Sab
    const idx = (jsDay + 6) % 7; // 0=Sen..6=Min
    counts[idx] += 1;
  });

  const svg = document.getElementById("weekChart");
  svg.innerHTML = "";
  const max = Math.max(1, ...counts);
  const barWidth = 32;
  const gap = (360 - barWidth * 7) / 8;
  const chartHeight = 170;

  counts.forEach((c, i) => {
    const h = Math.round((c / max) * chartHeight);
    const x = gap + i * (barWidth + gap);
    const y = chartHeight - h + 10;

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", barWidth);
    rect.setAttribute("height", h);
    rect.setAttribute("rx", 6);
    rect.setAttribute("fill", i === maxIndex(counts) ? "#4f46e5" : "#c7cbfa");
    svg.appendChild(rect);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x + barWidth / 2);
    label.setAttribute("y", chartHeight + 30);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "11");
    label.setAttribute("fill", "#8a8fa3");
    label.textContent = DAY_LABELS[i];
    svg.appendChild(label);
  });
}

function maxIndex(arr) {
  let idx = 0;
  arr.forEach((v, i) => { if (v > arr[idx]) idx = i; });
  return arr[idx] === 0 ? -1 : idx;
}

// --- Detail Data Kebocoran Pada Log Audit ---------------------------------

function renderLogList() {
  const list = document.getElementById("auditLogList");
  const countBadge = document.getElementById("logCountBadge");
  list.innerHTML = "";

  let filtered = fullAuditLog;
  if (logSearchQuery) {
    filtered = fullAuditLog.filter((e) => {
      const dom = (e.domain || "").toLowerCase();
      const action = (e.action || "").toLowerCase();
      const profile = (e.profileName || "").toLowerCase();
      const itemsMatch = (e.items || []).some((it) => {
        const lbl = (it.label || "").toLowerCase();
        const smp = (it.sample || "").toLowerCase();
        const smps = (it.samples || []).join(" ").toLowerCase();
        return lbl.includes(logSearchQuery) || smp.includes(logSearchQuery) || smps.includes(logSearchQuery);
      });
      return dom.includes(logSearchQuery) || action.includes(logSearchQuery) || profile.includes(logSearchQuery) || itemsMatch;
    });
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} Peristiwa`;
  }

  if (!filtered.length) {
    list.innerHTML = `
      <div class="db-empty">
        <i class="bi bi-inbox" style="font-size:24px; display:block; margin-bottom:6px; color:#cbd5e1;"></i>
        ${logSearchQuery ? `Tidak ada log yang cocok dengan pencarian "${escapeHtml(logSearchQuery)}".` : "Belum ada peristiwa kebocoran tercatat."}
      </div>
    `;
    return;
  }

  // Tampilkan hingga 50 entri terbaru
  filtered.slice(0, 50).forEach((e, idx) => {
    const card = document.createElement("div");
    card.className = "db-log-item";

    const isSanitized = e.action === "sanitized";
    const totalItems = (e.items || []).reduce((s, it) => s + (it.count || 1), 0);
    const actionLabel = isSanitized ? "Disamarkan" : "Dikirim Asli";
    const actionClass = isSanitized ? "sanitized" : "override";
    const actionIcon = isSanitized ? "bi-shield-check" : "bi-send-exclamation";

    // Chip tag preview
    const tagsHtml = (e.items || []).map((it) => {
      const sampleText = (it.samples && it.samples.length) ? it.samples[0] : (it.sample || "");
      const samplePreview = sampleText ? `: <code>${escapeHtml(sampleText)}</code>` : "";
      return `<span class="db-item-chip"><i class="bi bi-tag-fill"></i> ${escapeHtml(it.label)} (${it.count}x)${samplePreview}</span>`;
    }).join("");

    // Detail rows for expanded view
    const detailRowsHtml = (e.items || []).map((it) => {
      const allSamples = (it.samples && it.samples.length) ? it.samples : (it.sample ? [it.sample] : []);
      const sampleBadges = allSamples.length
        ? allSamples.map(s => `<code class="db-sample-val">${escapeHtml(s)}</code>`).join(" ")
        : `<span class="db-text-muted">Tidak tercatat</span>`;

      return `
        <div class="db-detail-row">
          <div class="db-detail-col-type">
            <span class="db-type-badge"><i class="bi bi-exclamation-triangle-fill"></i> ${escapeHtml(it.label)}</span>
            <span class="db-count-badge">${it.count}x terdeteksi</span>
          </div>
          <div class="db-detail-col-val">
            <div class="db-val-label">Data Yang Bocor:</div>
            <div class="db-val-list">${sampleBadges}</div>
          </div>
          <div class="db-detail-col-token">
            <div class="db-val-label">Pengganti Sensor:</div>
            <code class="db-token-val">${escapeHtml(it.token || `[REDACTED_${it.type}]`)}</code>
          </div>
        </div>
      `;
    }).join("");

    const snippetHtml = e.snippet ? `
      <div class="db-snippet-box">
        <div class="db-snippet-label"><i class="bi bi-chat-left-quote-fill"></i> Cuplikan Pesan Yang Berisiko:</div>
        <div class="db-snippet-content">"${escapeHtml(e.snippet)}"</div>
      </div>
    ` : "";

    card.innerHTML = `
      <div class="db-log-summary">
        <div class="db-log-left">
          <span class="db-action-pill ${actionClass}">
            <i class="bi ${actionIcon}"></i> ${actionLabel}
          </span>
          <div class="db-log-main-info">
            <div class="db-log-title">
              <strong>${totalItems} Data Sensitif</strong> dicegat di <strong>${escapeHtml(e.domain)}</strong>
            </div>
            <div class="db-log-meta">
              <span><i class="bi bi-clock"></i> ${formatTime(e.ts)}</span>
              <span>•</span>
              <span><i class="bi bi-person-workspace"></i> Mode: ${escapeHtml(e.profileName || "Standar")}</span>
            </div>
          </div>
        </div>
        <button type="button" class="db-toggle-detail-btn" data-target="detail-${idx}">
          <i class="bi bi-chevron-down"></i> Detail Data Bocor
        </button>
      </div>

      <div class="db-log-chips">
        ${tagsHtml}
      </div>

      <div class="db-log-detail-panel sw-hidden" id="detail-${idx}">
        <div class="db-detail-panel-inner">
          <div class="db-detail-heading">
            <i class="bi bi-info-circle-fill"></i> Detail Data Yang Terjadi Kebocorannya:
          </div>
          <div class="db-detail-table">
            ${detailRowsHtml}
          </div>
          ${snippetHtml}
        </div>
      </div>
    `;

    // Toggle detail panel
    const toggleBtn = card.querySelector(".db-toggle-detail-btn");
    const detailPanel = card.querySelector(`#detail-${idx}`);

    toggleBtn.addEventListener("click", () => {
      detailPanel.classList.toggle("sw-hidden");
      const isVisible = !detailPanel.classList.contains("sw-hidden");
      toggleBtn.innerHTML = isVisible
        ? `<i class="bi bi-chevron-up"></i> Tutup Detail`
        : `<i class="bi bi-chevron-down"></i> Detail Data Bocor`;
      if (isVisible) {
        card.classList.add("expanded");
      } else {
        card.classList.remove("expanded");
      }
    });

    list.appendChild(card);
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Hari ini, ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Kemarin, ${time}`;
  return `${d.toLocaleDateString("id-ID")}, ${time}`;
}

// --- Export Log dengan Detail Data Lengkap ---------------------------------

function exportLog(log, format) {
  let blob, filename;
  if (format === "json") {
    blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    filename = "smart-workspace-audit-log.json";
  } else {
    const header = "id,timestamp,domain,action,profile,total_items,details_leak,snippet\n";
    const rows = log.map((e) => {
      const itemsDetail = (e.items || []).map((it) => {
        const samples = (it.samples && it.samples.length) ? it.samples.join(";") : (it.sample || "");
        return `[${it.label} (${it.count}x): ${samples} -> ${it.token || ''}]`;
      }).join(" | ");

      const cleanSnippet = (e.snippet || "").replace(/[\r\n,"]/g, " ");

      return [
        `"${e.id}"`,
        `"${new Date(e.ts).toISOString()}"`,
        `"${e.domain}"`,
        `"${e.action}"`,
        `"${e.profileName || ''}"`,
        (e.items || []).reduce((s, it) => s + (it.count || 1), 0),
        `"${itemsDetail.replace(/"/g, '""')}"`,
        `"${cleanSnippet}"`
      ].join(",");
    });
    blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    filename = "smart-workspace-audit-log.csv";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
