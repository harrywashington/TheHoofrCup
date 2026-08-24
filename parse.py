import csv, json, re, os
from datetime import datetime

RAW_DIR = "/home/claude/ff-site/raw"
OUT_DIR = "/home/claude/ff-site/data"

# Canonicalize player name variants (same person, different spelling across years)
NAME_ALIASES = {
    "Freddie Akrouche": "Fred Akrouche",
    "James OBrien": "James O'Brien",
}

def canon(name):
    name = name.strip()
    return NAME_ALIASES.get(name, name)

def slugify(s):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s

def read_rows(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        return list(csv.reader(f))

def is_blank(row):
    return all(c.strip() == "" for c in row)

def parse_score_row(row, start_idx, num_rounds):
    """Rows in these exports trim blank TRAILING round columns, but always
    keep the running Total as the last field. So we take the last field as
    Total, everything between start_idx and the last field as sequential
    round scores (Round 1, Round 2, ...), and pad the rest with blanks."""
    if len(row) <= start_idx:
        return [""] * num_rounds, ""
    total = row[-1].strip()
    round_vals = [c.strip() for c in row[start_idx:-1]]
    round_vals = (round_vals + [""] * num_rounds)[:num_rounds]
    return round_vals, total

def parse_tournament(path):
    rows = read_rows(path)
    i = 0
    while i < len(rows) and is_blank(rows[i]):
        i += 1

    # Title row: Tournament name, date
    name, date_display = rows[i][0].strip(), rows[i][1].strip()
    i += 1
    try:
        date_iso = datetime.strptime(date_display, "%B %d, %Y").date().isoformat()
    except ValueError:
        try:
            date_iso = datetime.strptime(date_display, "%b %d, %Y").date().isoformat()
        except ValueError:
            date_iso = ""
    year = int(date_iso[:4]) if date_iso else None

    players = []
    strokeplay_tables = []  # list of {rows: [...]} in order encountered (pre-filter)
    ryder_cup = None
    best_ball = None
    skins = None
    courses = []

    while i < len(rows):
        row = rows[i]
        if is_blank(row):
            i += 1
            continue

        label = row[0].strip()

        if label == "Players":
            i += 1
            header = rows[i]; i += 1
            while i < len(rows) and not is_blank(rows[i]):
                r = rows[i]
                players.append({
                    "name": canon(r[0]),
                    "handicap": float(r[1]) if r[1].strip() else None,
                    "role": r[2].strip(),
                })
                i += 1
            continue

        if label == "Strokeplay":
            i += 1
            header = rows[i]; i += 1  # Player, Round1..RoundN, Total
            num_rounds = len(header) - 2
            entries = []
            while i < len(rows) and not is_blank(rows[i]):
                r = rows[i]
                player = canon(r[0])
                round_scores, total = parse_score_row(r, 1, num_rounds)
                entries.append({"player": player, "rounds": round_scores, "total": total})
                i += 1
            strokeplay_tables.append({"num_rounds": num_rounds, "entries": entries})
            continue

        if label == "Ryder Cup":
            i += 1
            header = rows[i]; i += 1  # Team, Player, Round1..RoundN, Total
            num_rounds = len(header) - 3
            teams = []
            current_team = None
            while i < len(rows) and not is_blank(rows[i]):
                r = rows[i]
                team_name = r[0].strip()
                player_name = r[1].strip()
                if team_name:
                    _pts, total = parse_score_row(r, 2, num_rounds)
                    current_team = {
                        "team": team_name,
                        "total": total,
                        "players": []
                    }
                    teams.append(current_team)
                if player_name and current_team is not None:
                    pts, _total = parse_score_row(r, 2, num_rounds)
                    current_team["players"].append({
                        "player": canon(player_name),
                        "points_by_round": pts,
                    })
                i += 1
            ryder_cup = {"teams": teams}
            continue

        if label == "Best Ball":
            i += 1
            header = rows[i]; i += 1
            num_rounds = len(header) - 3
            teams = []
            current_team = None
            while i < len(rows) and not is_blank(rows[i]):
                r = rows[i]
                team_name = r[0].strip()
                player_name = r[1].strip() if len(r) > 1 else ""
                if team_name:
                    _pts, total = parse_score_row(r, 2, num_rounds)
                    current_team = {
                        "team": team_name,
                        "total": total,
                        "players": []
                    }
                    teams.append(current_team)
                if player_name and current_team is not None:
                    pts, _total = parse_score_row(r, 2, num_rounds)
                    current_team["players"].append({
                        "player": canon(player_name),
                        "points_by_round": pts,
                    })
                i += 1
            if teams:
                best_ball = {"teams": teams}
            continue

        if label == "Skins":
            i += 1
            header = rows[i]; i += 1
            num_rounds = len(header) - 2
            entries = []
            while i < len(rows) and not is_blank(rows[i]):
                r = rows[i]
                player = canon(r[0])
                round_scores, total = parse_score_row(r, 1, num_rounds)
                entries.append({"player": player, "rounds": round_scores, "total": total})
                i += 1
            skins = entries
            continue

        if label.startswith("Round "):
            # We've hit the hole-by-hole section. Grab course names then stop
            # detailed parsing (not needed for Home/Players/Leaderboard pages).
            i += 1
            continue

        # Course/date header rows within round blocks, e.g. "Sand Valley Resort-Sand Valley Course","May 4, 2024 12:00 PM"
        if len(row) >= 2 and re.search(r'\d{1,2}:\d{2}\s?(AM|PM)', row[1]):
            course = row[0].strip()
            if course and course not in courses:
                courses.append(course)
            i += 1
            continue

        i += 1

    # Filter out "practice round" strokeplay tables: total equals round1 for all
    # entries and every other round is blank.
    real_strokeplay = []
    for t in strokeplay_tables:
        is_practice = True
        for e in t["entries"]:
            other_rounds_filled = any(rs.strip() for rs in e["rounds"][1:])
            if other_rounds_filled:
                is_practice = False
                break
        if not is_practice and t["entries"]:
            # also require at least one entry with a real total across >1 round
            real_strokeplay.append(t)

    gross = real_strokeplay[0] if len(real_strokeplay) > 0 else None
    net = real_strokeplay[1] if len(real_strokeplay) > 1 else None

    return {
        "id": slugify(f"{name}-{year}"),
        "name": name,
        "year": year,
        "date": date_iso,
        "dateDisplay": date_display,
        "courses": courses,
        "numRounds": gross["num_rounds"] if gross else None,
        "players": players,
        "leaderboard": {
            "gross": gross["entries"] if gross else [],
            "net": net["entries"] if net else [],
        },
        "ryderCup": ryder_cup,
        "bestBall": best_ball,
        "skins": skins,
    }

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    tournaments = []
    for fname in sorted(os.listdir(RAW_DIR)):
        if fname.endswith(".csv"):
            path = os.path.join(RAW_DIR, fname)
            t = parse_tournament(path)
            tournaments.append(t)
            print(f"Parsed: {t['name']} ({t['year']}) - {len(t['players'])} players, "
                  f"{len(t['leaderboard']['gross'])} gross entries, "
                  f"{len(t['leaderboard']['net'])} net entries, "
                  f"courses={t['courses']}")

    tournaments.sort(key=lambda t: t["date"])

    with open(os.path.join(OUT_DIR, "tournaments.json"), "w") as f:
        json.dump(tournaments, f, indent=2)

    print(f"\nWrote {len(tournaments)} tournaments to tournaments.json")

if __name__ == "__main__":
    main()
