/**
 * Sanitization Engine — Smart Workspace Extension
 * Berjalan sepenuhnya on-device (tanpa panggilan API eksternal).
 * Dipakai bersama oleh content.js dan dashboard.js.
 */

const SWSanitizer = (function () {

  // --- Pola deteksi bawaan -------------------------------------------------

  const PATTERNS = [
    {
      type: "NIK",
      label: "NIK",
      token: "[REDACTED_NIK]",
      // 16 digit angka berurutan (format NIK Indonesia), dengan batas kata
      regex: /\b\d{16}\b/g,
      validate: (match) => {
        // Validasi ringan: 2 digit provinsi tidak boleh 00, dan bulan lahir (digit 9-10,
        // setelah dikurangi 40 untuk perempuan) harus 01-12
        const provinsi = parseInt(match.slice(0, 2), 10);
        if (provinsi === 0 || provinsi > 94) return false;
        let bulan = parseInt(match.slice(8, 10), 10);
        if (bulan > 40) bulan -= 40;
        return bulan >= 1 && bulan <= 12;
      }
    },
    {
      type: "EMAIL",
      label: "Email",
      token: "[REDACTED_EMAIL]",
      regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g
    },
    {
      type: "CARD",
      label: "Nomor Kartu",
      token: "[REDACTED_CARD]",
      // 13-19 digit, boleh dipisah spasi/dash setiap 4 digit
      regex: /\b(?:\d[ -]?){13,19}\b/g,
      validate: (match) => {
        const digits = match.replace(/[ -]/g, "");
        if (digits.length < 13 || digits.length > 19) return false;
        return luhnCheck(digits);
      }
    },
    {
      type: "APIKEY",
      label: "API Key",
      token: "[REDACTED_APIKEY]",
      // Pola umum: sk-..., ghp_..., AIza..., AKIA..., Bearer <token>, atau string
      // acak panjang (>=24 karakter) campuran huruf besar/kecil/angka.
      regex: /\b(sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z\-_]{20,}|AKIA[0-9A-Z]{12,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._\-]{16,}|(?=[A-Za-z0-9_\-]*[0-9])(?=[A-Za-z0-9_\-]*[A-Za-z])[A-Za-z0-9_\-]{24,})\b/g
    }
  ];

  function luhnCheck(numStr) {
    let sum = 0;
    let alt = false;
    for (let i = numStr.length - 1; i >= 0; i--) {
      let n = parseInt(numStr[i], 10);
      if (alt) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alt = !alt;
    }
    return sum % 10 === 0;
  }

  /**
   * Memindai teks dan mengembalikan daftar temuan + versi teks yang sudah disamarkan.
   * customKeywords: [{term, label}]
   * enabled: {nik, email, apikey, card, keywords} — detektor mana yang aktif
   */
  function scan(text, customKeywords, enabled) {
    enabled = enabled || { nik: true, email: true, apikey: true, card: true, keywords: true };
    if (!text || typeof text !== "string") {
      return { findings: [], sanitized: text || "" };
    }

    const findings = [];
    // Kumpulkan semua rentang match dari yang PALING PANJANG dulu supaya tidak tumpang tindih
    const matches = [];

    const typeEnabledMap = { NIK: "nik", EMAIL: "email", APIKEY: "apikey", CARD: "card" };

    PATTERNS.forEach((p) => {
      if (enabled[typeEnabledMap[p.type]] === false) return;
      const re = new RegExp(p.regex.source, p.regex.flags);
      let m;
      while ((m = re.exec(text)) !== null) {
        const raw = m[0];
        if (p.validate && !p.validate(raw)) continue;
        matches.push({
          start: m.index,
          end: m.index + raw.length,
          type: p.type,
          label: p.label,
          token: p.token,
          raw
        });
      }
    });

    if (enabled.keywords !== false && customKeywords && customKeywords.length) {
      customKeywords.forEach((kw) => {
        if (!kw.term) return;
        const escaped = kw.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp("\\b" + escaped + "\\b", "gi");
        let m;
        while ((m = re.exec(text)) !== null) {
          matches.push({
            start: m.index,
            end: m.index + m[0].length,
            type: "KEYWORD",
            label: kw.label || `Kata Kunci: ${kw.term}`,
            token: `[REDACTED_${(kw.label || kw.term).toUpperCase().replace(/[^A-Z0-9]/g, "_")}]`,
            raw: m[0]
          });
        }
      });
    }

    // Urutkan berdasarkan posisi mulai, buang overlap (prioritaskan match lebih panjang)
    matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const cleaned = [];
    let lastEnd = -1;
    matches.forEach((m) => {
      if (m.start >= lastEnd) {
        cleaned.push(m);
        lastEnd = m.end;
      }
    });

    // Bangun teks tersamarkan
    let sanitized = "";
    let cursor = 0;
    cleaned.forEach((m) => {
      sanitized += text.slice(cursor, m.start) + m.token;
      cursor = m.end;
    });
    sanitized += text.slice(cursor);

    // Ringkas temuan per tipe untuk ditampilkan di popover dan audit log
    const grouped = {};
    cleaned.forEach((m) => {
      const key = m.type + "|" + m.label;
      if (!grouped[key]) {
        grouped[key] = {
          type: m.type,
          label: m.label,
          token: m.token,
          count: 0,
          sample: m.raw,
          samples: [],
          details: []
        };
      }
      grouped[key].count += 1;
      if (!grouped[key].samples.includes(m.raw)) {
        grouped[key].samples.push(m.raw);
      }
      grouped[key].details.push({
        raw: m.raw,
        start: m.start,
        end: m.end
      });
    });

    return {
      findings: Object.values(grouped),
      allMatches: cleaned,
      totalCount: cleaned.length,
      hasSensitive: cleaned.length > 0,
      sanitized,
      originalText: text
    };
  }

  return { scan, PATTERNS };
})();

if (typeof module !== "undefined") {
  module.exports = SWSanitizer;
}
