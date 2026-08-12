#!/usr/bin/env python3
"""Generate the illustrative donor set the network explorations render.

NOTHING HERE IS A REAL DONOR. The explorations need a network dense enough to
show 50/100/150/200 milestones and school clustering, and Harvard in Tech has no
donor list yet — production starts empty and stays empty until Nicole's first
upload. So this file fabricates one, deterministically, from a fixed seed.

The first eighteen entries are NOT fabricated names: they are the curated set
already committed in `src/pages/isolated-components/[name].astro` (`FULL_DONORS`),
reused verbatim so the explorations show the same people the existing donor-wall
scenarios show. They arrive here extended with the two fields Nicole's spreadsheet
adds and the current model lacks — `school` and `gradYear` — plus a `joinIndex`
recording giving order, which the ripple and timeline variations lay out by and
the milestone animations count up.

Usage: python3 build-donors.py   # writes donors.json beside this file
"""

import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))

# One fixed seed so regenerating never reshuffles the network under a screenshot
# Nicole has already commented on.
random.seed(20260805)

# ── The curated eighteen ────────────────────────────────────────────────────
# Lifted from FULL_DONORS. `tier` is deliberately dropped: Nicole's spreadsheet
# carries no dollar amounts, so giving level has no input and the explorations
# have to recognize people by something other than how much they gave.
CURATED = [
    ("Margaret Chen-Alvarez", "Harvard Business School", 1998, True, False,
     "Gave the week the fund opened, before there was anything to show for it."),
    ("Robert K. Whitmore", "Harvard College", 1987, True, True, None),
    ("David Osei-Bonsu", "Harvard Kennedy School", 2011, False, False, None),
    ("Priya Raman", "Harvard SEAS", 2014, True, False,
     "Two intros from a founder dinner turned into my first enterprise customer."),
    ("Jonathan Feld", "Harvard College", 2003, False, False, None),
    ("Aisha Rahman", "Harvard Business School", 2016, False, False,
     "For the London chapter, which is the only reason I still feel connected."),
    ("Tomás Vidal", "Harvard SEAS", 2009, False, False, None),
    ("Hannah Brightwell", "Harvard Law School", 2012, False, False, None),
    ("Kwame Boateng", "Harvard College", 2019, False, False,
     "Small gift, every year, for as long as this keeps going."),
    ("Elena Marchetti", "Harvard GSD", 2007, False, False, None),
    ("Samuel Oyelaran", "Harvard SEAS", 2021, False, False, None),
    ("Grace Lindqvist", "Harvard College", 1995, True, False, None),
    ("Nina Petrova", "Harvard Chan School", 2013, False, True, None),
    ("Michael Okonkwo", "Harvard Business School", 2006, False, False, None),
    ("Rebecca Stern", "Harvard College", 2018, False, False, None),
    ("Yusuf Al-Amin", "Harvard Kennedy School", 2015, False, False, None),
    ("The Lindgren Family", "Harvard College", 1979, False, False,
     "Three generations went through the College. This is the least we can do."),
    ("Clara Ndiaye", "Harvard Extension School", 2020, False, False, None),
]

# ── Pools for the fabricated remainder ──────────────────────────────────────
FIRST = [
    "Amara", "Andrei", "Anjali", "Beatriz", "Caleb", "Camila", "Chidi", "Claire",
    "Daniel", "Deepa", "Dmitri", "Elias", "Emeka", "Fatima", "Felix", "Fiona",
    "Gabriel", "Hana", "Hassan", "Helena", "Ibrahim", "Imani", "Isabel", "Jae-won",
    "Jasmine", "Javier", "Jonas", "Julia", "Kenji", "Khalid", "Laila", "Lars",
    "Leila", "Lucas", "Maja", "Marcus", "Mei", "Miriam", "Nadia", "Nikhil",
    "Noor", "Olga", "Omar", "Paulo", "Rania", "Ravi", "Rosa", "Ruth", "Sabine",
    "Santiago", "Sofia", "Soren", "Tariq", "Thandiwe", "Tobias", "Valentina",
    "Wei", "Yara", "Yohannes", "Zara", "Adaeze", "Bjorn", "Carmen", "Dawit",
    "Esther", "Farida", "Gunnar", "Ines", "Jamal", "Kirsten", "Leonardo",
    "Malika", "Niamh", "Oscar", "Petra", "Quentin", "Rohan", "Salma", "Theo",
    "Ulrich", "Vera", "Wendy", "Xavier", "Yuki", "Zainab",
]
LAST = [
    "Abebe", "Adeyemi", "Ahmed", "Almeida", "Andersson", "Bakker", "Barros",
    "Bergstrom", "Bianchi", "Castellanos", "Chatterjee", "Chowdhury", "Dabiri",
    "Delacroix", "Diallo", "Dubois", "Eriksen", "Fernandes", "Fitzgerald",
    "Gallagher", "Gonzalez", "Haddad", "Hoffmann", "Ibarra", "Iwu", "Jensen",
    "Kaur", "Keller", "Kimura", "Kowalski", "Larsson", "Lindqvist", "Mabaso",
    "Maalouf", "Mensah", "Moreau", "Nakamura", "Navarro", "Nguyen", "Nkemelu",
    "Novak", "Okafor", "Oyelaran", "Papadopoulos", "Pereira", "Petrov",
    "Quintero", "Rasmussen", "Reyes", "Rossi", "Saito", "Sandoval", "Schneider",
    "Sharma", "Silva", "Sorensen", "Tadesse", "Takahashi", "Tanaka", "Thompson",
    "Vargas", "Virtanen", "Wachowski", "Wang", "Weiss", "Yamamoto", "Zhang",
    "Zielinski", "Achebe", "Bouchard", "Cardoso", "Devereux", "Espinoza",
    "Fontaine", "Grimaldi", "Halvorsen", "Ivanova", "Jamil",
]

# Weighted so the College and the professional schools dominate the way a real
# alumni list would, rather than every school appearing equally.
SCHOOLS = (
    ["Harvard College"] * 30
    + ["Harvard Business School"] * 22
    + ["Harvard SEAS"] * 16
    + ["Harvard Kennedy School"] * 10
    + ["Harvard Law School"] * 7
    + ["Harvard GSAS"] * 5
    + ["Harvard Medical School"] * 3
    + ["Harvard GSD"] * 3
    + ["Harvard GSE"] * 2
    + ["Harvard Chan School"] * 2
    + ["Harvard Extension School"] * 2
)

# Nicole: the note says WHY they are supporting HIT. Optional, and most people
# leave it blank — so only about a fifth of the set carries one, and the layouts
# have to look right when the majority have nothing to show.
NOTES = [
    "The NYC chapter is where I met my co-founder.",
    "I got my first job in tech through someone I met at a HIT dinner.",
    "Because nobody did this for me when I graduated, and it took me years longer.",
    "Paying back the intro that changed my career.",
    "My daughter is starting her first engineering role. I want this to exist for her.",
    "The mentorship program matched me with someone who talked me out of quitting.",
    "For the Tokyo chapter — being an alum abroad is lonely without it.",
    "Twenty years out and this is the only alumni thing I actually show up to.",
    "Supporting the people doing the unglamorous organizing work.",
    "I want the next generation to have a network that isn't just who they already knew.",
    "The SF events have been worth more to me than any conference I've paid for.",
    "Because a community that only exists when someone funds it deserves funding.",
    "Met three of my current teammates through this network.",
    "For the students. The job market is brutal right now.",
    "HIT introduced me to my first investor. That is not a small thing.",
    "I believe alumni networks should be useful, not ceremonial.",
    "Small gift now, bigger one when my company exits.",
    "The LA chapter got started because a few people cared. I want to be one of them.",
    "Giving because I was asked directly, which is apparently all it takes.",
    "This is the group that answered when I was between jobs.",
]

# ── Build ───────────────────────────────────────────────────────────────────
TARGET = 200
FOUNDING_CUTOFF = 60  # the founding cohort: gave before the fund had a track record
ANON_RATE = 0.06      # a real list always has a few

donors = []
used_names = set()


def slugify(name):
    return "".join(c.lower() if c.isalnum() else "-" for c in name).strip("-")


for name, school, year, founding, anon, note in CURATED:
    used_names.add(name)
    donors.append({
        "name": name, "school": school, "gradYear": year,
        "founding": founding, "anonymous": anon, "note": note,
    })

while len(donors) < TARGET:
    name = f"{random.choice(FIRST)} {random.choice(LAST)}"
    if name in used_names:
        continue
    used_names.add(name)
    idx = len(donors)
    donors.append({
        "name": name,
        "school": random.choice(SCHOOLS),
        "gradYear": random.randint(1984, 2025),
        # Founding is about WHEN you gave, not how much — so it tracks position
        # in the list rather than any amount, which the spreadsheet never carries.
        "founding": idx < FOUNDING_CUTOFF,
        "anonymous": random.random() < ANON_RATE,
        "note": random.choice(NOTES) if random.random() < 0.20 else None,
    })

# joinIndex is 1-based giving order: the ripple variation places donors on rings
# by it, the timeline lays them along 2026 by it, and every variation counts it
# up through the 50/100/150/200 milestones.
for i, d in enumerate(donors):
    d["joinIndex"] = i + 1
    d["slug"] = slugify(d["name"])

out = {
    "_warning": "ILLUSTRATIVE DATA — no real donor appears in this file. "
                "Generated by build-donors.py for design exploration only.",
    "generatedBy": "build-donors.py",
    "milestones": [50, 100, 150, 200],
    "donors": donors,
}

path = os.path.join(HERE, "donors.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)

named = sum(1 for d in donors if not d["anonymous"])
print(f"wrote {path}")
print(f"  {len(donors)} donors — {named} named, {len(donors)-named} anonymous")
print(f"  {sum(1 for d in donors if d['founding'])} founding")
print(f"  {sum(1 for d in donors if d['note'])} with a note")
print(f"  {len(set(d['school'] for d in donors))} schools")
