## Problem

Every dog-social product fails the same three ways. Profile creation is a chore, so profiles are sparse and stale and nobody finishes onboarding. Matching is appearance-first swiping, so energy levels mismatch, meetups go badly and people churn. Coordination happens off-platform, so there is no feedback loop and no network effect.

## Product

The whole product is one prompt box. "Find my dog an energetic playmate nearby this weekend." Everything else appears inside the conversation:

1. **Sign up** — e-mail and password, or a passwordless link.
2. **Connect a photo source** — a direct upload or an authorised platform export. No scraping, no passwords, no browser automation.
3. **The system finds your dog** — photos are classified, grouped per dog, quality-scored; the best shot becomes the profile picture.
4. **A complete profile appears** — breed, age, size, energy, play style, temperament. Every field shows where it came from and how confident the system is.
5. **You correct it by talking** — "He's actually four, not three." "Only find dogs within 15 km."
6. **You state a goal and get ranked matches**, each with the reasons and the caveats written out.
7. **Introductions are mutual.** Nobody is committed to meeting a stranger automatically.
8. **Then you message and arrange a meetup** — at a public place near the midpoint; nobody's address is shared.

## Two things it deliberately does not do

- **It never invents facts about your dog.** Breed and energy can be inferred from photos and captions. Health, genetics, pedigree, vaccination and reproductive status cannot — those stay blank until the owner enters them. Enforced by a database constraint, not by convention.
- **It never presents a mating match as breeding approval.** Mating is a separate, explicitly opted-into mode that reports *what information exists*, ranked by data completeness, with a standing disclaimer.

## Matching concept

Hard constraints run in SQL. Weighted scoring is a pure function over activity, play style, size, temperament and schedule. Only then does a language model turn the computed signal contributions into sentences. It cannot reorder or invent candidates. The same discipline applies to the agent: the model's only output is an action name plus arguments, re-validated against a typed registry, with sensitive actions parked in a confirmation table until a human clicks. Prompt injection cannot reach the database.

## Prototype

The build is a monorepo: a Fastify API with PostgreSQL and a Postgres-backed job queue (no Redis), a React 19 web app that installs to an iPhone home screen as a PWA, and an offline heuristic AI provider by default (an external model is optional). `start.ps1` creates secrets, downloads a self-contained PostgreSQL, migrates, seeds a demo neighbourhood, builds the web app and serves everything on one port. The smoke suite walks the full journey and asserts the safety properties: CSRF rejection, IDOR returning 404, no e-mail or exact coordinates in any response, bucketed distances, confirmation-gated introductions, admin routes closed to normal users.

<Video src="/media/doggystyle-demo.mp4" caption="Recorded walkthrough of the running system — landing prompt, sign-up, photo import, generated profile, a correction, ranked matches, mutual introduction, messaging, meetup." poster="/images/doggystyle/01-landing.webp"/>

## Privacy

Exact location is never sent to another user — not in an API response, not in a distance, not in photo metadata. Distances are bucketed, stored coordinates are snapped to a ~1 km grid, uploaded images are re-encoded to strip EXIF/GPS, and meetup locations are public places revealed only after both owners agree. The threat model (STRIDE) and the privacy and security notes are in the repository.

## Roadmap

The end-to-end journey works and is verified on every run of the smoke suite. Before any public pilot it still needs a production environment (TLS, backups, monitoring), a per-module unit test suite, real content moderation, stronger age assurance, and — per the business plan — a name change with trademark clearance. *Doggystyle* is a working name; the code is ready for the rename (one line).

<Repo url="https://github.com/boggioMichael/doggystyle" note="TypeScript · React · PostgreSQL · BUSL-1.1"/>
