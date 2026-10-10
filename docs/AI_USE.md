# Use of AI in this project

Team Protikriti, NASA Space Apps Challenge 2026, *Interplanetary Survival Guide: Martian Map*.

## Tools
- **Claude** (Anthropic) through **Claude Code**, in the terminal. Used for writing and refactoring code, tests, documentation and this repository's configuration.
- **ChatGPT** (OpenAI) image generation, used once for the artwork on pitch-video Slide 2 (the Mars puzzle image). [Team: add the model name and version shown in ChatGPT, and the date.]

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
- Produce any image, video or audio shown in the app. The only generated image in the pitch video is the Slide 2 puzzle artwork from ChatGPT (see Tools and Prompts). It is illustration, not NASA data, and shows no real terrain, people or logos. [Team: confirm there is no other generated image, video or audio.]
- The astronaut-arm picture behind the EVA dashboard (`web/public/assets/wrist-console.webp`) was supplied by the team as `Sci-Fi Astronaut Wrist HUD Console.png`; the code only converts it to WebP and places the screens on it. [Team: state its source and licence.] Nothing on the screens is invented: no suit vitals, only the walk's own numbers.

## Prompts
- The standing instructions given to the AI are in `CLAUDE.md` and `PRODUCT.md`.
- Plans and specs it helped write are in `docs/superpowers/`.
- **Pitch Slide 2 image (ChatGPT, image generation).** The prompt was drafted with Claude and given to ChatGPT, which produced the picture. Prompt used:

  > Cinematic wide shot, 16:9, of a dim Mars landscape at dusk: rust-red regolith, a distant ancient river delta with layered fan-shaped sediment, low hills, and a hazy butterscotch sky fading to cool blue at the horizon. Floating just above the ground at centre-left, slightly tilted, are five large jigsaw puzzle pieces that almost fit together, separated by thin glowing amber seams with small gaps between them, as if the puzzle is still unsolved. Each piece has a different Mars-data texture and carries one short label printed on its surface in clean, bold, white sans-serif capital letters, perfectly spelled and easy to read: piece one, grey-brown topographic contour lines, labelled "TERRAIN"; piece two, a warm orange-and-purple thermal gradient, labelled "POWER"; piece three, pale blue-white ice crystals, labelled "WATER ICE"; piece four, layered ochre and cream rock strata, labelled "GEOLOGY"; piece five, a deep red speckle with a faint hairline crack and a small white warning triangle, labelled "RADIATION". Above the cluster, in the upper left, add one large headline in the same white sans-serif capitals: "MARS: A PUZZLE OF CONNECTED PIECES". Soft low-sun rim lighting, drifting dust particles, shallow depth of field, a faint scientific grid fading into the sky. Keep the rest of the upper left and the bottom third dark and uncluttered. Palette: deep brown #1a0f0a, rust #b84a1e, amber #d97706, teal #0d7377 accents. Realistic cinematic concept art, high contrast, clean and premium. The only text in the image is the five labels and the headline, exactly as written. No logos, no other letters or numbers, no people, astronauts, faces or hands, no watermark, no cartoon or flat-vector style.

  [Team: note how many attempts it took and any edits you made to the image.]
- [Team: add key prompts used for the pitch script and any other generated text, and say how you edited them.]

## Our own work
[Team: list what each member designed, decided, wrote or edited by hand.]
