## Question

Lip reading from video helps people who cannot hear a recording and harms people who did not know they were being watched. The same model does both. Before [[lab/thelip]] has code, what should it refuse to do, and can the refusals be built into the system rather than written into a policy nobody reads?

## The lines

1. **Candidates, never transcripts.** The output type is a ranked list of guesses with confidence, and the interface never shows a single string as "what was said". A system that cannot express doubt will be quoted as if it had none.
2. **No identity.** Finding which face is speaking is a detection problem; finding whose face it is is a surveillance problem. The prototype does the first and has no code path for the second.
3. **Local by default.** Video stays on the user's machine. Any upload is a separate, explicit act.
4. **Consent or absence of audio.** The intended inputs are footage the participants agreed to, or archival and accessibility cases where no audio exists. Reading strangers across a room is out of scope, and the published limits should make it a poor tool for that anyway.
5. **Published limits.** Error rates by condition — lighting, angle, compression, language — are documentation, not a footnote.

## Why the lines help the engineering

Each refusal is also a measurement discipline. "Candidates with confidence" forces calibration. "No identity" keeps the model small and the data requirements modest. "Local by default" forces efficiency on consumer hardware. "Published limits" forces a test set with labelled conditions. The ethics and the evidence culture are the same practice, which is also what [[projects/maplesyrup]] found from the other direction.

## Open questions

- Can "no identity" survive contact with a multi-speaker scene where tracking a mouth across frames is, in effect, re-identification within the clip? Where exactly is the line between tracking and identifying?
- Is language identification from visemes alone a capability worth having, given that it narrows the candidate set for a listener who already knows the language?
- What would a third party need to see to believe the limits are real rather than stated?
