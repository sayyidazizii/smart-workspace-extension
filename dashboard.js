document.addEventListener("DOMContentLoaded", init);

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

async function init() {
  const { auditLog } = await chrome.storage.local.get(["auditLog"]);
  const log = auditLog || [];

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = log.filter((e) => now - e.ts <= weekMs);
  const lastWeek = log.filter((e) => now - e.ts > weekMs && now - e.ts <= weekMs * 2);

  renderScore(thisWeek, lastWeek);
  renderTotals(thisWeek);
  renderTopType(thisWeek);
  renderRatio(thisWeek);
  renderWeekChart(thisWeek);
  renderLogList(log.slice(0, 12));

  document.getElementById("btnExportCsv").addEventListener("click", () => exportLog(log, "csv"));
  document.getElementById("btnExportJson").addEventListener("click", () => exportLog(log, "json"));
}

function computeScore(entries) {
  if (!entries.length) return 100;
  const sanitized = entries.filter((e) => e.action === "sanitized").length;
  return Math.round((sanitized / entries.length) * 100);
}

function renderScore(thisWeek, lastWeek) {
  const score = computeScore(thisWeek);
  const prevScore = computeScore(lastWeek);
  const circumference = 2 * Math.PI * 58;
  const arc = document.getElementById("scoreArc");
  arc.setAttribute("stroke-dasharray", `${circumference}`);
  arc.setAttribute("stroke-dashoffset", `${circumference * (1 - score / 100)}`);
  document.getElementById("scoreNum").textContent = score;

  const diff = score - prevScore;
  const trendEl = document.getElementById("scoreTrend");
  if (thisWeek.length === 0 && lastWeek.length === 0) {
    trendEl.textContent = "Belum ada data";
    trendEl.style.color = "#8a8fa3";
  } else if (diff >= 0) {
    trendEl.textContent = `▲ Naik ${diff} poin minggu ini`;
    trendEl.style.color = "#16a34a";
  } else {
    trendEl.textContent = `▼ Turun ${Math.abs(diff)} poin minggu ini`;
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
      counts[it.label] = (counts[it.label] || 0) + it.count;
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
  document.getElementById("topTypeSub").textContent = `${count} dari ${total} kejadian`;
}

function renderRatio(thisWeek) {
  const total = thisWeek.length;
  const sanitized = thisWeek.filter((e) => e.action === "sanitized").length;
  const pct = total ? Math.round((sanitized / total) * 100) : 0;
  document.getElementById("ratioFill").style.width = pct + "%";
  document.getElementById("ratioSanitizedLabel").textContent = `Disamarkan ${pct}%`;
  document.getElementById("ratioOverrideLabel").textContent = `Dikirim asli ${100 - pct}%`;
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

function renderLogList(entries) {
  const list = document.getElementById("auditLogList");
  list.innerHTML = "";
  if (!entries.length) {
    list.innerHTML = `<div class="db-empty">Belum ada peristiwa tercatat.</div>`;
    return;
  }
  entries.forEach((e) => {
    const row = document.createElement("div");
    row.className = "db-log-item";
    const typeLabel = (e.items || []).map((it) => it.label).join(", ") || "Data sensitif";
    const actionLabel = e.action === "sanitized" ? `${typeLabel} disamarkan` : `${typeLabel} dikirim asli (override)`;
    row.innerHTML = `
      <span class="db-log-dot ${e.action}"></span>
      <div>
        <div class="db-log-title">${actionLabel}</div>
        <div class="db-log-sub">${e.domain} • ${formatTime(e.ts)}</div>
      </div>`;
    list.appendChild(row);
  });
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Kemarin, ${time}`;
  return `${d.toLocaleDateString("id-ID")}, ${time}`;
}

function exportLog(log, format) {
  let blob, filename;
  if (format === "json") {
    blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
    filename = "smart-workspace-audit-log.json";
  } else {
    const header = "id,timestamp,domain,action,items\n";
    const rows = log.map((e) => {
      const items = (e.items || []).map((it) => `${it.label}:${it.count}`).join("|");
      return [e.id, new Date(e.ts).toISOString(), e.domain, e.action, items].join(",");
    });
    blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    filename = "smart-workspace-audit-log.csv";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
