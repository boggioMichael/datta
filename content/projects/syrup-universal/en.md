## The question

[[projects/maplesyrup]] answers "what is happening in *this* game" for one game, with its HUD layout, dialog keywords and monster facts written into the core types. Syrup Universal asks the harder question: can a companion learn whatever game its player is playing — identify it, work out what the screen shows, pick up the mechanics from what it sees and what it reads, remember the player, and coach — without knowing anything about the game in advance?

The test applied to every design decision: *would this still work if tomorrow the player launched a game nobody has ever seen?*

## Boundaries

Syrup sees what the player sees and says things. Nothing else.

- **Input:** screen pixels of the game window (and, later, the audio the player hears).
- **Output:** short text and speech, and marks drawn in its own window.
- **Never:** reading or writing game memory, injecting code, hooking the renderer, touching network traffic, private game APIs, or sending input to the game. There is no input automation anywhere in the codebase.

## The pipeline

<Diagram src="/diagrams/syrup-universal.svg" caption="Capture and sampling, a scene analyzer that finds the HUD by stability, an Observation that feeds game recognition and temporal tracking, a state engine that infers concepts, and a coach fed by a knowledge graph with provenance." alt="Vertical pipeline: any game window, capture and frame sampler, scene analyzer with detectors, observation, game recognizer and temporal tracker side by side, game state engine, then player model, coach engine and knowledge in a row, and finally text, speech and marks in its own window." wide/>

The design priorities, in order: **universality › modularity › correctness › debuggability › realtime performance › visual polish.** When two of them conflict, the earlier one wins.

## What carries over, what does not

The reuse analysis is written down in the repository and is the honest part of the project: it lists, item by item, what MapleSyrup proved and is worth keeping — the non-invasive boundary, `Detection<T>` with confidence and failure reasons, the temporal building blocks, reading values as text first and bar fill only as corroboration, skin-agnostic panel finding, the debugger that draws the same boxes the engine reports — and what is deliberately left behind: MapleStory as the centre of the design, fixed regions of interest, OCR on every frame, and a heavy Python companion window.

MapleStory's specifics move into a plugin. The core types name no HP, MP, minimap or chat log; those are *concepts* a game may turn out to have, discovered from what is seen ("a bar that falls when the screen shakes and ends in a death screen is probably health") and stored in that game's profile.

## Status

The architecture is published on `main`. The MVP is being built on a branch and is not merged yet; nothing here claims it runs. When it does, the first evidence will be a replay on a synthetic game with exact ground truth, then a real game it has never seen.

<Repo url="https://github.com/boggioMichael/us" note="Rust · MIT · work in progress"/>
