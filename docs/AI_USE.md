# Use of AI in this project

Team Protikriti, NASA Space Apps Challenge 2026, *Interplanetary Survival Guide: Martian Map*.

## Tools
- **Claude** (Anthropic) through **Claude Code**, in the terminal. Used for writing and refactoring code, tests, documentation and this repository's configuration.

## What the AI did
- Wrote first drafts of most TypeScript and Python code, and its unit tests, under the standards in `CLAUDE.md` (tests first, strict type checks).
- Drafted documentation: `README.md`, `docs/data-sources.md`, the demo script and the pitch script.
- No AI model runs inside the app. Routing, slope, Mars time and panorama stitching are ordinary tested code (`web/src/core/`, `pipeline/`). The app never asks a model for a number.

## What the AI did not do
- Choose the challenge, the Jezero and Gale sites, the 15° slope limit, or the product direction. The team decided these.
- Supply any data. Every dataset comes from NASA, USGS or the IAU and is cited in `docs/data-sources.md`.
- Produce images, video or audio shown in the app or the pitch videos. [Team: confirm.]

## Prompts
- The standing instructions given to the AI are in `CLAUDE.md` and `PRODUCT.md`.
- Plans and specs it helped write are in `docs/superpowers/`.
- [Team: add key prompts used for the pitch script and any other generated text, and say how you edited them.]

## Our own work
[Team: list what each member designed, decided, wrote or edited by hand.]
