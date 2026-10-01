## The idea

Static analyzers are precise and shallow; language models are deep and unreliable. *saca* would run the precise tools first, hand their output and the surrounding code to a model only where the rules run out — an unexplained `unsafe` block, a lock taken in two orders — and label every finding with its origin: **rule** or **model**. The reader should always know which kind of confidence they are looking at.

## Status

A repository with a README and a licence, from September 2025. No code. It stays in the lab because the question is still interesting and the answer is still cheap to prototype.
