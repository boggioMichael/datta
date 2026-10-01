<Callout kind="note" title="About this page">
This is a factual record of a piece of software. The game was built for the Israeli party *Amkha Yisrael* (עמך ישראל), as its own README states. Datta is a studio, not a political organisation, and nothing on this site is campaign material; the project is listed here because it exists, it is open source, and it is technically interesting.
</Callout>

## What it is

A phone game played in the browser. You drag a finger to walk, people on the street join your chain as you pass them, you hold hands with friends in the same chain, and you lose people if you hit another chain or leave the city limits. There is a mini-map, a satellite view, and on the whole-country map a toggle for the Green Line.

- **55 municipalities**, each map the real jurisdiction from OpenStreetMap up to 3.6 km from the centre, plus a whole-country map and a map of the "promised borders" with today's borders drawn thin.
- **Rooms by map**, sized by area (8–50 players); a room that is nearly empty is filled with bots, and the bots leave as people arrive. Bots are always marked and never impersonate a person.
- **A single-player story mode**, "Against All Odds": thirteen chapters in five books across nine cities, in which a party polling at 1.2% grows chapter by chapter; rivals are bots named after real parties, with opening seat counts taken from a published poll; a 120-seat Knesset that updates after each chapter; strategies chosen between books. The story and its characters are fictional and labelled as such.
- **A 3D street walk** built entirely from map data — buildings at their real footprints and heights where OpenStreetMap has them, pavements, crossings, parks, shop signs — because street-view photographs belong to their owners and cannot be used.
- **Five original music tracks** synthesised in the browser, growing as the chain grows.

## Principles written into it

No registration, no cookies, no tracking. IP addresses live only in the server's memory to limit connections and are never stored or logged. The game collects nothing about opinions, votes or volunteering. A bot never pretends to be a person. Open source under MIT.

## How it is built

A dependency-free Node server (the page, WebSocket, one room per map, a lobby endpoint); a simulation that runs identically in the browser and on the server; a tile map with streets, sea, parks, contour lines and names; the 3D street renderer in WebGL 2 with the geometry built without the DOM so it can be tested in Node; a network protocol at fifteen snapshots a second that sends a chain's body once and only new points afterwards (2–4 KB per second per player); a map builder in Python that runs in GitHub Actions; and a build script that packs everything into a single HTML file.

<Repo url="https://github.com/boggioMichael/chchchains" note="JavaScript · Node · WebGL 2 · MIT"/>
