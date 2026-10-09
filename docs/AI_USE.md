# Use of AI in this project

Team Protikriti, NASA Space Apps Challenge 2026, *Interplanetary Survival Guide: Martian Map*.

## Tools
- **Claude** (Anthropic) through **Claude Code**, in the terminal. Used for writing and refactoring code, tests, documentation and this repository's configuration.

## What the AI did
- Wrote first drafts of most TypeScript and Python code, and its unit tests, under the standards in `CLAUDE.md` (tests first, strict type checks).
- Wrote the OpenCV panorama step (`pipeline/src/marsmap/cahvore.py`, `navcam.py`, `pano.py`, `streetview.py`) and its tests, after watching a public OpenCV image-stitching tutorial (Nicolai Nielsen, YouTube) the team pointed it to.
- Drafted documentation: `README.md`, `docs/data-sources.md`, the demo script and the pitch script.
- No AI model runs inside the app. Routing, slope, Mars time and panorama stitching are ordinary tested code (`web/src/core/`, `pipeline/`). The app never asks a model for a number.
- One trained model exists, offline: a scikit-learn Random Forest in `pipeline/src/marsmap/classify.py` that we train on NASA's AI4Mars human labels to complete the terrain labels on whole panoramas (method and limits in `docs/data-sources.md`). It is our own small model, not a language model and not a third-party one. The app only shows its precomputed output, and no route, slope or other figure depends on it.
- The 25 cm HiRISE walk-patch tiles are sharpened for display with classical OpenCV filters only (`pipeline/src/marsmap/enhance.py`). No super-resolution or generative model is used, so no terrain is invented.
- The tidied HiRISE strips on the globe use classical OpenCV and SciPy only (Hough-free oriented seam detection, Poisson re-integration, phase correlation to CTX): no learned or generative model, so no terrain is invented (`pipeline/src/marsmap/strips.py`).
- Claude wrote the code for that model, the sky and rover masks, and the rock detector; the team chose to use AI4Mars labels and reviewed the output over the panoramas.

## Terrain label accuracy (held-out stops)
Measured by training on 4 of every 5 stops and scoring the fifth (`classify-panoramas --evaluate`). Share of each class's true pixels the forest finds, Perseverance: soil 51%, bedrock 50%, sand 48%, big rock 33% (rocks are 0.4% of labelled pixels). That is modest: about half of each class. Curiosity figures are in `data/pano/msl_labels.log` after a run. Rocks shown in the app also come from a contrast rule (`docs/data-sources.md`) that has not been scored against people's labels.

## What the AI did not do
- Choose the challenge, the Jezero and Gale sites, the 15° slope limit, or the product direction. The team decided these.
- Supply any data. Every dataset comes from NASA, USGS or the IAU and is cited in `docs/data-sources.md`.
- Produce images, video or audio shown in the app or the pitch videos. [Team: confirm.]
- The astronaut-arm picture behind the EVA dashboard (`web/public/assets/wrist-console.webp`) was supplied by the team as `Sci-Fi Astronaut Wrist HUD Console.png`; the code only converts it to WebP and places the screens on it. [Team: state its source and licence.] Nothing on the screens is invented: no suit vitals, only the walk's own numbers.

## Prompts
- The standing instructions given to the AI are in `CLAUDE.md` and `PRODUCT.md`.
- Plans and specs it helped write are in `docs/superpowers/`.
- [Team: add key prompts used for the pitch script and any other generated text, and say how you edited them.]

## Our own work
[Team: list what each member designed, decided, wrote or edited by hand.]
