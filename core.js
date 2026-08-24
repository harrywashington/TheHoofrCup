/* =========================================================================
   Core: data loading, score parsing, stat aggregation.
   Shared by every page. No dependencies.
   ========================================================================= */

const SITE = {
  // Leave blank until the crew has a name; the nav shows the mark alone.
  name: "",
  tagline: "Great courses. Real competition. Twelve months of bragging rights.",
  est: 2024,
};

/* ---- Data loading ---------------------------------------------------- */
// Resolve data paths relative to the site root so pages in any folder work.
async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json();
}

async function loadData() {
  const [tournaments, upcoming, playersMeta] = await Promise.all([
    loadJSON("data/tournaments.json"),
    loadJSON("data/upcoming.json").catch(() => ({ trips: [] })),
    loadJSON("data/players.json").catch(() => ({ players: [] })),
  ]);
  return {
    tournaments: tournaments.sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    upcoming: (upcoming.trips || []).sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    playersMeta: playersMeta.players || [],
  };
}

/* ---- Score parsing --------------------------------------------------- */
// "E" -> 0, "+12" -> 12, "-3" -> -3, "" -> null
function parseScore(s) {
  if (s === null || s === undefined) return null;
  s = String(s).trim();
  if (s === "") return null;
  if (s.toUpperCase() === "E") return 0;
  const n = Number(s.replace("+", ""));
  return Number.isNaN(n) ? null : n;
}

// Format a to-par number back to display: 0 -> "E", 12 -> "+12", -3 -> "-3"
function fmtToPar(n, decimals = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "\u2014";
  const v = decimals ? Number(n.toFixed(decimals)) : Math.round(n);
  if (v === 0) return "E";
  return v > 0 ? `+${v}` : `${v}`;
}

function ordinal(n) {
  if (n === null || n === undefined) return "\u2014";
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function initials(name) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

/* ---- Rankings within a single tournament ----------------------------- */
// Returns Map<player, {score, rank}> using standard competition ranking.
function rankBoard(entries) {
  const scored = entries
    .map((e) => ({ player: e.player, score: parseScore(e.total) }))
    .filter((e) => e.score !== null)
    .sort((a, b) => a.score - b.score);
  const out = new Map();
  let rank = 0, seen = 0, prev = null;
  for (const row of scored) {
    seen++;
    if (row.score !== prev) { rank = seen; prev = row.score; }
    out.set(row.player, { score: row.score, rank });
  }
  return out;
}

/* ---- Ryder Cup record parsing --------------------------------------- */
// "6-2-0" -> {w:6,l:2,t:0, pts:6, played:8}
function parseRyder(rec) {
  if (!rec) return { w: 0, l: 0, t: 0, pts: 0, played: 0, display: "0-0-0" };
  const [w, l, t] = rec.split("-").map((x) => parseInt(x, 10) || 0);
  return { w, l, t, pts: w + 0.5 * t, played: w + l + t, display: rec };
}

/* ---- All-time aggregation ------------------------------------------- */
// Builds one row per player across all played tournaments.
function buildAllTime(data) {
  const { tournaments, playersMeta } = data;
  const players = new Map();

  const ensure = (name) => {
    if (!players.has(name)) {
      players.set(name, {
        name,
        trips: 0,
        grossWins: 0, netWins: 0,
        bestGross: null, bestNet: null,
        grossTotals: [], netTotals: [],
        lastHandicap: null,
        ryder: parseRyder(null),
      });
    }
    return players.get(name);
  };

  // Seed from meta (captures crew with 0 trips + authoritative Ryder records)
  for (const m of playersMeta) {
    const p = ensure(m.name);
    if (m.ryderCup) p.ryder = parseRyder(m.ryderCup);
  }

  for (const t of tournaments) {
    const grossRank = rankBoard(t.leaderboard.gross || []);
    const netRank = rankBoard(t.leaderboard.net || []);

    // Roster presence = appeared on the trip
    const roster = new Set((t.players || []).map((p) => p.name));
    for (const rp of (t.players || [])) {
      const p = ensure(rp.name);
      if (rp.handicap !== null && rp.handicap !== undefined) p.lastHandicap = rp.handicap;
    }
    for (const name of roster) ensure(name).trips++;

    for (const [name, info] of grossRank) {
      const p = ensure(name);
      p.grossTotals.push(info.score);
      p.bestGross = p.bestGross === null ? info.rank : Math.min(p.bestGross, info.rank);
      if (info.rank === 1) p.grossWins++;
    }
    for (const [name, info] of netRank) {
      const p = ensure(name);
      p.netTotals.push(info.score);
      p.bestNet = p.bestNet === null ? info.rank : Math.min(p.bestNet, info.rank);
      if (info.rank === 1) p.netWins++;
    }
  }

  const rows = [...players.values()].map((p) => ({
    ...p,
    avgGross: p.grossTotals.length ? p.grossTotals.reduce((a, b) => a + b, 0) / p.grossTotals.length : null,
    avgNet: p.netTotals.length ? p.netTotals.reduce((a, b) => a + b, 0) / p.netTotals.length : null,
    rcPts: p.ryder.pts,
  }));

  return rows;
}

/* ---- Champions per tournament --------------------------------------- */
function championsFor(t) {
  const g = rankBoard(t.leaderboard.gross || []);
  const n = rankBoard(t.leaderboard.net || []);
  const winner = (map) => [...map.entries()].find(([, v]) => v.rank === 1)?.[0] || null;
  return { gross: winner(g), net: winner(n) };
}

/* ---- Shared chrome: nav + footer ------------------------------------ */
const MARK = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <circle cx="16" cy="16" r="15" stroke="currentColor" stroke-width="1.4"/>
  <path d="M13 8.5v15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M13 8.6c3.4-1.9 5.6 1.2 8.4-.2v6.2c-2.8 1.4-5-1.7-8.4.2" fill="currentColor" opacity="0.9"/>
  <circle cx="13" cy="24" r="1.5" fill="currentColor"/>
</svg>`;

function renderNav(active) {
  const links = [
    { href: "index.html", label: "Home", key: "home" },
    { href: "players.html", label: "Players", key: "players" },
    { href: "leaderboard.html", label: "Leaderboard", key: "leaderboard" },
  ];
  const name = SITE.name
    ? `<span class="brand-name">${SITE.name}</span>` : "";
  return `<nav class="nav"><div class="nav-inner">
    <a class="brand" href="index.html" aria-label="Home" style="color:var(--green)">${MARK}${name}</a>
    <div class="nav-links">
      ${links.map((l) => `<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`).join("")}
    </div>
  </div></nav>`;
}

function renderFooter() {
  const yr = new Date().getFullYear();
  return `<footer class="footer"><div class="footer-inner">
    <a class="brand" href="index.html" style="color:var(--green)">${MARK}</a>
    <p>${SITE.tagline}</p>
    <p>Est. ${SITE.est} \u00b7 &copy; ${yr}</p>
  </div></footer>`;
}

function mountChrome(active) {
  const navEl = document.getElementById("nav");
  const footEl = document.getElementById("footer");
  if (navEl) navEl.outerHTML = renderNav(active);
  if (footEl) footEl.outerHTML = renderFooter();
}

/* ---- Scroll reveal --------------------------------------------------- */
function initReveal() {
  const els = document.querySelectorAll(".reveal");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!("IntersectionObserver" in window) || reduce) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
  els.forEach((el) => io.observe(el));
  // Fail-safe: reveal anything already in the viewport on load immediately,
  // and unconditionally reveal everything after a short delay so no content
  // can ever be left stuck at opacity:0 (e.g. if the observer misses it).
  requestAnimationFrame(() => {
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
    });
  });
  setTimeout(() => {
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in"));
  }, 1400);
}
