[**Play OH MY GOD →**](https://boggiomichael.github.io/datta/omg/)

## The game

A neon ring, a spout at the top, and a crawling baby falling out of it. Every run starts there. Two identical rides that touch merge into the next one up, and the new ball is bigger and bounces out: walking, running, a bicycle, an e-scooter, a Vespa, a Harley, a Kia Picanto, a Mini, a Jeep, a Porsche, a Ferrari F40, a Bugatti Chiron, a Formula 1 car, the Bagger 288, the Mallard, a Shinkansen, a superyacht, an aircraft carrier, a hot-air balloon, a 747, Concorde, the SR-71, Vostok 1, the Saturn V, the Space Shuttle, Starship, the Parker Solar Probe — then hoverboards, mechs, saucers, warp drives, wormholes and a time machine — then the rides of the gods: Ganesha's mouse, Hermes' sandals, Freyja's cats, Sun Wukong's cloud, Pegasus, Sleipnir, Thor's goats, Garuda, Airavata, Ra's barque, Helios' chariot — then Noah's Ark, Jonah's great fish, Jacob's ladder, the pillar of fire, Elijah's chariot, Ezekiel's wheels within wheels, the cherub, the Messiah's white donkey, and finally the last boss: the God of Israel.

That is 124 tiers in 14 eras. Every merge shouts “oh my god”: a crawl gets a squeaky toy, a bicycle gets its bell, a Harley gets a V-twin, a train gets its horn, an ocean liner gets a foghorn, Apollo gets “Houston…”, the gods get a choir, the donkey gets a shofar. God gets everything.

New tiers arrive with a slow-motion beat, a camera punch and a title; every era opens with its own card, backdrop and music. Chain reactions, rush hours, earthquakes, crosswinds and zero-g keep the ring busy. Build high enough and the spout upgrades, so the journey keeps climbing.

## Options

Eight modes (Classic, Watch, Chaos, Mega, Trampoline, Black Hole, Time Attack, Sandbox), six tools (shake, magnet, bomb, slow-motion, gravity flip, upgrade), and 36 settings: speed up to ×8, drip rate up to a flood, gravity from the Moon to Jupiter, bounciness, container size, growth per merge, journey length, random events, chain combos, a bounce melody, voice styles, drama level, ball styles, era scenery, ring colours, flashes, labels, trails, phone tilt and an editable reel-style caption. A collection keeps every tier you have reached, with its sound.

## How it is built

The whole game is a Rust crate with no dependencies, compiled to WebAssembly. It owns the physics, the rules, the ladder, the options, the progression and even the scenery, and it produces a list of draw commands every frame; a thin JavaScript shell paints that list on a canvas and forwards touches.

The sound is Rust too. A second instance of the same WebAssembly runs in a Web Worker and renders every sound on demand: it takes one of 33 short voice clips (generated once with the open Kokoro speech model) and pushes it through pitch-shifting, time-stretching, vocoder choirs, reverb and a side-chained bed of synthesised effects, then masters it louder at every tier, from about −27 LUFS for the crawl to about −9.5 for God.

The 123 illustrations were drawn for the game as hand-written SVG. Model names appear for the joke; there are no company logos.
