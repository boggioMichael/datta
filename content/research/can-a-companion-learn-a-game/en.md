## Question

Can a companion that sees only what the player sees — pixels, and later audio — work out what a game is, learn its mechanics from observation and from reading, learn the player, and coach usefully, for a game it has never been trained on?

## Background

Agents that *play* games are a mature field: given an environment with a defined action space and a reward, reinforcement learning produces superhuman players. That is not this question. Here the agent never acts. It has no action space. Its only outputs are short sentences and marks in its own window, and its only input is the screen. The reward, if there is one, is the player's own improvement.

The constraint is deliberate. A companion that reads memory or injects code is unsafe next to any game with anti-cheat and is tied to one game's internals. A companion that only watches can sit next to anything.

## What makes it hard

- **No labels.** The HUD is not announced. Health is "a bar that falls when the screen shakes and ends in a death screen". Every concept has to be inferred from behaviour.
- **Uncertainty is the normal case.** Compression, UI scale, occlusion and animation all degrade reading. The system must prefer "I don't know" to a confident wrong number.
- **Knowledge has provenance.** Advice that cannot say where it came from — a wiki, a patch note, the last ten minutes of play — is not advice.
- **Interruption is a design problem.** A coach that talks at the wrong moment is worse than silence. Spoilers are a special case of the same problem.
- **Real-time is a budget, not a slogan.** See [[research/pixel-only-perception-measured]].

## What exists toward an answer

[[projects/maplesyrup]] answers the question for one game, with the game's specifics written into its types, and has been measured. [[lab/syrup]] extracts the game-neutral primitives. [[projects/syrup-universal]] is the attempt at the general case; its architecture is published and its MVP is being built.

## How the question would be settled

A synthetic game with exact ground truth, so the perception can be scored precisely; then a real game the system has never seen, judged on whether a player who used it for an hour learned something they would not have otherwise. The second test is the one that matters and the harder one to run honestly.
