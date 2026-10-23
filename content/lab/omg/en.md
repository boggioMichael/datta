[**Play OH MY GOD →**](https://boggiomichael.github.io/datta/omg/)

## The game

A neon ring, a spout at the top, and a Kia Picanto falling out of it. Two identical rides that touch merge into the next one up: a Jeep, a Tesla, a BMW, a Ferrari, a Shelby, a Bugatti, a Pagani — then a Cessna, a Gulfstream, a 747, Concorde, the SR-71 — then Soyuz, the Shuttle, Apollo 11, Starship, the ISS — then flying cars, saucers, teleporters, light speed, wormholes and time machines — then the vehicles of the gods: Sun Wukong's cloud, Pegasus, Sleipnir, Thor's goats, Garuda, Ra's barque, Helios' chariot — then Elijah's chariot of fire, the Messiah's white donkey, and finally the last boss: the God of Israel.

Every merge shouts “oh my god”. A Picanto gets a shrug; a Bugatti gets a scream over a quad-turbo W16; a 747 gets the captain on the PA; Apollo 11 gets “Houston…” through Quindar beeps and a rocket; the gods get “oh my gods” sung by a choir; the donkey gets a shofar. God gets everything.

Build high enough and the spout upgrades and the whole picture zooms out, so the journey keeps going without the ring overflowing.

## Options

Six modes (Classic, Watch, Chaos, Black Hole, Time Attack, Sandbox), six tools (shake, magnet, bomb, slow-motion, gravity flip, upgrade), and 29 settings: speed up to ×8, gravity from the Moon to Jupiter, bounce, magnet assist, journey length, starting tier, ring size and spin, hard mode, voice styles (robot, choir, chipmunk, giant, stadium), music, ring colours, particles, flashes, labels, trails, phone tilt and an editable reel-style caption. A collection keeps every tier you have reached, with its sound.

## How it is built

The whole game is a Rust crate with no dependencies, compiled to WebAssembly (about 300 KB). It owns the physics, the rules, the ladder, the options and the progression, and it produces a list of draw commands every frame; a thin JavaScript shell paints that list on a canvas and forwards touches.

The sound is Rust too. A second instance of the same WebAssembly runs in a Web Worker and renders every sound on demand: it takes one of 33 short voice clips (generated once with the open Kokoro speech model) and pushes it through pitch-shifting, time-stretching, vocoder choirs, reverb and a side-chained bed of synthesised effects — engines, jets, sonic booms, rockets, thunder, gongs, harps, a shofar — then masters it louder at every tier, from about −26 LUFS for the Picanto to about −9.5 for God.

Model names appear for the joke; there are no company logos in the game.
