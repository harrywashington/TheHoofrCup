/* All-Time Leaderboard: one sortable table combining every stat we track. */

const COLUMNS = [
  { key: "name",      label: "Player",     type: "text",  player: true },
  { key: "trips",     label: "Trips",      type: "num",   dir: "desc" },
  { key: "grossWins", label: "Gross W",    type: "num",   dir: "desc" },
  { key: "netWins",   label: "Net W",      type: "num",   dir: "desc" },
  { key: "bestGross", label: "Best Gross", type: "pos",   dir: "asc" },
  { key: "bestNet",   label: "Best Net",   type: "pos",   dir: "asc" },
  { key: "avgGross",  label: "Avg Gross",  type: "par",   dir: "asc" },
  { key: "avgNet",    label: "Avg Net",    type: "par",   dir: "asc" },
  { key: "ryderDisp", label: "Ryder Cup",  type: "text2", dir: "desc", sortBy: "rcPts" },
  { key: "rcPts",     label: "RC Pts",     type: "pts",   dir: "desc" },
];

let STATE = { rows: [], sortKey: "netWins", sortDir: "desc" };

function cellValue(row, col) {
  switch (col.type) {
    case "text":  return `<td class="player-col">${row.name}</td>`;
    case "text2": return `<td>${row.ryder.display}</td>`;
    case "num":   return `<td>${row[col.key]}</td>`;
    case "pts":   return `<td>${row.rcPts % 1 ? row.rcPts.toFixed(1) : row.rcPts}</td>`;
    case "pos": {
      const v = row[col.key];
      if (v === null) return `<td class="dim">\u2014</td>`;
      const medal = v === 1 ? ' medal' : '';
      return `<td><span class="pos${medal}">${ordinal(v)}</span></td>`;
    }
    case "par": {
      const v = row[col.key];
      return v === null ? `<td class="dim">\u2014</td>` : `<td>${fmtToPar(v, 1)}</td>`;
    }
    default: return `<td>\u2014</td>`;
  }
}

function sortRows() {
  const col = COLUMNS.find((c) => (c.sortBy || c.key) === STATE.sortKey) ||
              COLUMNS.find((c) => c.key === STATE.sortKey);
  const key = STATE.sortKey;
  const dir = STATE.sortDir === "asc" ? 1 : -1;

  const val = (r) => {
    if (key === "name") return r.name.toLowerCase();
    if (key === "rcPts") return r.rcPts;
    const v = r[key];
    return v;
  };

  STATE.rows.sort((a, b) => {
    let av = val(a), bv = val(b);
    // Nulls always sink to the bottom regardless of direction.
    const an = av === null || av === undefined;
    const bn = bv === null || bv === undefined;
    if (an && bn) return a.name.localeCompare(b.name);
    if (an) return 1;
    if (bn) return -1;
    if (typeof av === "string") return dir * av.localeCompare(bv);
    if (av === bv) {
      // stable tiebreak: fewer avg strokes, then name
      const at = a.avgNet ?? 999, bt = b.avgNet ?? 999;
      return (at - bt) || a.name.localeCompare(b.name);
    }
    return dir * (av - bv);
  });
}

function render() {
  sortRows();
  const thead = COLUMNS.map((c) => {
    const sk = c.sortBy || c.key;
    const sorted = sk === STATE.sortKey;
    const arrow = sorted ? (STATE.sortDir === "asc" ? "\u2191" : "\u2193") : "";
    return `<th data-key="${sk}" class="${c.player ? "player-col " : ""}${sorted ? "sorted" : ""}">${c.label}<span class="arrow">${arrow}</span></th>`;
  }).join("");

  const body = STATE.rows.map((row, i) => {
    const rankCell = `<td class="rank">${i + 1}</td>`;
    const cells = COLUMNS.map((c) => cellValue(row, c)).join("");
    return `<tr>${rankCell.replace("<td", "<td").replace("</td>", "</td>")}${cells}</tr>`;
  }).join("");

  document.getElementById("lb-mount").innerHTML = `
    <div class="lb-scroll">
      <table class="lb">
        <thead><tr><th class="rank" style="cursor:default"></th>${thead}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="lb-note">Tap any column to sort. Ryder Cup shown as wins\u2011losses\u2011ties (win = 1 pt, tie = \u00bd). Scoring averages are to par across scored trips.</p>
  `;

  document.querySelectorAll("table.lb thead th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      const col = COLUMNS.find((c) => (c.sortBy || c.key) === key);
      if (STATE.sortKey === key) {
        STATE.sortDir = STATE.sortDir === "asc" ? "desc" : "asc";
      } else {
        STATE.sortKey = key;
        STATE.sortDir = col?.dir || "desc";
      }
      render();
    });
  });
}

async function main() {
  mountChrome("leaderboard");
  const app = document.getElementById("app");
  try {
    const data = await loadData();
    STATE.rows = buildAllTime(data).filter((p) => p.trips > 0); // board = those who've played

    app.innerHTML = `
      <section class="hero"><div class="hero-inner">
        <p class="eyebrow">The Record Book</p>
        <h1>All-time leaderboard.</h1>
        <p class="sub">Wins, best finishes, scoring averages, and the Ryder Cup ledger \u2014 across every trip, in one table.</p>
      </div></section>

      <section class="section">
        <div class="wrap"><div id="lb-mount"></div></div>
      </section>
    `;
    render();
  } catch (err) {
    app.innerHTML = `<section class="section"><div class="wrap"><p class="loading">Couldn\u2019t load leaderboard data. If previewing locally, run a local server (see README).</p></div></section>`;
    console.error(err);
  }
}

main();
