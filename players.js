/* Players: a clean card grid, one per crew member, with career stats. */

function playerCard(p) {
  const rookie = p.trips === 0;
  const av = `<div class="avatar ${rookie ? "rookie" : ""}">${initials(p.name)}</div>`;
  const sub = rookie
    ? "Yet to tee it up"
    : `${p.trips} ${p.trips === 1 ? "trip" : "trips"}${p.lastHandicap != null ? ` \u00b7 ${p.lastHandicap} hcp` : ""}`;

  const stat = (v, k) => `<div class="pc-stat"><div class="v">${v}</div><div class="k">${k}</div></div>`;

  const stats = rookie
    ? stat("\u2014", "Best gross") + stat("\u2014", "Best net") + stat("\u2014", "Gross wins") + stat("\u2014", "Net wins")
    : stat(ordinal(p.bestGross), "Best gross") +
      stat(ordinal(p.bestNet), "Best net") +
      stat(p.grossWins, "Gross wins") +
      stat(p.netWins, "Net wins");

  return `<article class="player-card reveal">
    <div class="pc-top">${av}<div><h3>${p.name}</h3><div class="pc-sub">${sub}</div></div></div>
    <div class="pc-stats">${stats}</div>
    <div class="pc-foot"><span class="k">Ryder Cup (W\u2011L\u2011T)</span><span class="rc">${p.ryder.display}</span></div>
  </article>`;
}

async function main() {
  mountChrome("players");
  const app = document.getElementById("app");
  try {
    const data = await loadData();
    const rows = buildAllTime(data);

    // Sort: most trips, then best net finish, then name. Rookies fall to the end.
    rows.sort((a, b) =>
      (b.trips - a.trips) ||
      ((a.bestNet ?? 99) - (b.bestNet ?? 99)) ||
      a.name.localeCompare(b.name)
    );

    const veterans = rows.filter((p) => p.trips > 0);
    const rookies = rows.filter((p) => p.trips === 0);

    app.innerHTML = `
      <section class="hero"><div class="hero-inner">
        <p class="eyebrow">The Field</p>
        <h1>The players.</h1>
        <p class="sub">Every competitor \u2014 appearances, best finishes, and where they stand in the Ryder Cup ledger.</p>
      </div></section>

      <section class="section">
        <div class="wrap">
          <div class="players-grid">${veterans.map(playerCard).join("")}</div>
          ${rookies.length ? `
            <div class="section-head" style="margin-top:var(--sect)">
              <p class="eyebrow">On the Tee</p>
              <h2>Awaiting their debut.</h2>
              <p>On the crew, not yet on the board.</p>
            </div>
            <div class="players-grid">${rookies.map(playerCard).join("")}</div>
          ` : ""}
        </div>
      </section>
    `;
    initReveal();
  } catch (err) {
    app.innerHTML = `<section class="section"><div class="wrap"><p class="loading">Couldn\u2019t load player data. If previewing locally, run a local server (see README).</p></div></section>`;
    console.error(err);
  }
}

main();
