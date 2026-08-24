/* Home: hero for the next trip, the trip lineup (history + upcoming), stats. */

const ICON = {
  pin: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.6"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  flag: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 21V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 4.5c3-1.6 5 1 8-.2v6.4c-3 1.2-5-1.4-8 .2" fill="currentColor"/></svg>`,
};

const CONTOURS = `<svg class="hero-contours" viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g fill="none" stroke="#14432f" stroke-width="1">
    <path d="M-40 470 C 220 400, 340 500, 600 430 S 1020 360, 1260 440" opacity="0.10"/>
    <path d="M-40 430 C 240 350, 360 460, 600 385 S 1030 305, 1260 400" opacity="0.09"/>
    <path d="M-40 390 C 260 300, 380 420, 600 340 S 1040 250, 1260 360" opacity="0.08"/>
    <path d="M-40 350 C 280 250, 400 380, 600 295 S 1050 195, 1260 320" opacity="0.07"/>
    <path d="M-40 310 C 300 205, 420 340, 600 250 S 1060 140, 1260 280" opacity="0.06"/>
    <path d="M-40 270 C 320 160, 440 300, 600 205 S 1070 90, 1260 240" opacity="0.05"/>
    <path d="M-40 230 C 340 120, 460 260, 600 165 S 1080 45, 1260 205" opacity="0.04"/>
  </g>
</svg>`;

function daysUntil(iso) {
  const target = new Date(iso + "T00:00:00");
  const now = new Date();
  const ms = target - now;
  return Math.max(0, Math.ceil(ms / 86400000));
}

function heroFor(next) {
  if (!next) {
    return `<section class="hero"><div class="hero-inner">
      <p class="eyebrow">The Annual Trip</p>
      <h1>Great courses.<br/>Better company.</h1>
      <p class="sub">${SITE.tagline}</p>
    </div></section>`;
  }
  const days = daysUntil(next.date);
  return `<section class="hero">
    ${CONTOURS}
    <div class="hero-inner">
      <p class="eyebrow">Next Trip \u00b7 ${next.dateDisplay}</p>
      <h1>${next.name}</h1>
      <p class="sub">Five courses over four days across the Sand Valley sandscape.</p>
      <div class="countdown" aria-label="Countdown to the next trip">
        <div class="unit"><div class="num">${days}</div><div class="lbl">Days to go</div></div>
      </div>
      <div class="meta">
        <span>${ICON.pin} ${next.courses.join(" \u00b7 ")}</span>
      </div>
    </div>
  </section>`;
}

function tripCard(trip, champs) {
  if (trip.upcoming) {
    return `<article class="trip-card reveal">
      <div class="tc-head">
        <div class="year">${trip.year}</div>
        <div class="status next">Next</div>
      </div>
      <h3>${trip.name}</h3>
      <div class="courses">${trip.courses.join(" \u00b7 ")}</div>
      <div class="when">${trip.dateDisplay}<small>Save the dates</small></div>
    </article>`;
  }
  const champRow = (label, name) => `<div class="champ-row">
    <span class="k">${ICON.flag && `<span class="flag">${ICON.flag}</span>`}${label}</span>
    <span class="v">${name || "\u2014"}</span>
  </div>`;
  return `<article class="trip-card reveal">
    <div class="tc-head">
      <div class="year">${trip.year}</div>
      <div class="status done">Complete</div>
    </div>
    <h3>${trip.name}</h3>
    <div class="courses">${(trip.courses || []).join(" \u00b7 ")}</div>
    <div class="champs">
      ${champRow("Gross champion", champs.gross)}
      ${champRow("Net champion", champs.net)}
    </div>
  </article>`;
}

function statBand(data, allTime) {
  const trips = data.tournaments.length;
  const playersPlayed = allTime.filter((p) => p.trips > 0).length;
  const rounds = data.tournaments.reduce((a, t) => a + (t.numRounds || 0), 0);
  return `<div class="statband">
    <div class="stat reveal"><div class="n">${trips}</div><div class="l">Trips played</div></div>
    <div class="stat reveal"><div class="n">${playersPlayed}</div><div class="l">Competitors</div></div>
    <div class="stat reveal"><div class="n">${rounds}</div><div class="l">Rounds contested</div></div>
    <div class="stat reveal"><div class="n">${data.tournaments.reduce((a,t)=>a+(t.courses?.length||0),0)}</div><div class="l">Courses conquered</div></div>
  </div>`;
}

async function main() {
  mountChrome("home");
  const app = document.getElementById("app");
  try {
    const data = await loadData();
    const allTime = buildAllTime(data);
    const next = data.upcoming[0] || null;

    // Lineup: played (desc by date) + upcoming, most recent/next first
    const played = [...data.tournaments].reverse();
    const cards = [];
    for (const trip of data.upcoming) cards.push(tripCard(trip, {}));
    for (const trip of played) cards.push(tripCard(trip, championsFor(trip)));

    app.innerHTML = `
      ${heroFor(next)}

      <section class="section">
        <div class="wrap">
          <div class="section-head">
            <p class="eyebrow">The Lineup</p>
            <h2>Every trip, one place.</h2>
            <p>A different destination every year \u2014 with the results, champions, and record book that come with it.</p>
          </div>
          <div class="lineup">${cards.join("")}</div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="section-head center">
            <p class="eyebrow">By the Numbers</p>
            <h2>The record so far.</h2>
          </div>
          ${statBand(data, allTime)}
        </div>
      </section>
    `;
    initReveal();
  } catch (err) {
    app.innerHTML = `<section class="section"><div class="wrap"><p class="loading">Couldn\u2019t load trip data. If you\u2019re previewing locally, run a local server (see README) \u2014 browsers block file access otherwise.</p></div></section>`;
    console.error(err);
  }
}

main();
