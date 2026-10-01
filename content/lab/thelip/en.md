## The question

How much of what a person says can be recovered from how their mouth moves, in ordinary video, by a system that is honest about its uncertainty? Human lip readers manage a fraction of words and lean heavily on context. The interesting engineering is not the headline accuracy; it is building something that says "probably *this*, possibly *that*, and here I do not know" — the same `Detection<T>` discipline as [[lab/syrup]], applied to faces instead of HUDs.

## Potential goals

- **Video input** from files and, later, from a browser.
- **Speaker detection** — which face is talking when several people are in frame.
- **Temporal mouth tracking** that survives head turns, occlusion and compression artefacts.
- **Language identification** from visemes alone.
- **Speech reconstruction** as ranked candidate text with confidence, never as a transcript presented as fact.

## Status

Research stage. The problem definition and the ethics boundary below exist; a repository does not yet exist in public. This page will state what works only when a replay on labelled video shows it.

## Ethics and privacy

Lip reading is dual-use in the most literal way, so the boundary is written before the code:

- **No surveillance use.** The prototype is for footage where the people involved consent or where no audio exists for accessibility or archival reasons — not for reading strangers across a room.
- **Candidates, not claims.** Output is ranked guesses with confidence. Nothing it produces should ever be presented as "what was said".
- **Local by default.** Video is processed on the user's machine; nothing is uploaded unless the user explicitly chooses to.
- **No face identification.** Finding *which* face is talking is not the same as finding *whose* face it is, and the project does the first only.
- **Published limits.** Error rates, failure modes and the conditions under which it is wrong are part of the documentation, not a footnote.

If a use case cannot meet those lines, the prototype is the wrong tool for it, and that is the intended outcome.
