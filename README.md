# AgriSense AI - Defender Protocol

AgriSense AI is an advanced, cinematic 3D web application designed for real-time crop disease detection and multi-agent advisory. It bridges the gap between agricultural pathology and cutting-edge GenAI, providing farmers and agronomists with instantaneous, accurate treatment protocols.

## Features
- **Vision Agent**: Scans crop leaves using Gemini 2.0 Flash to detect diseases, crop type, and urgency level.
- **RAG Knowledge Agent**: Cross-references detected diseases with an internal knowledge base of optimal recovery strategies.
- **Advisory Agent**: Compiles context from RAG and visual assessment into an actionable organic and chemical countermeasure protocol.
- **Market Agent**: Instantly queries the web for local suppliers of required chemical treatments using Google Search grounding.
- **Voice Agent**: Delivers real-time synthesized audio briefings (TTS) for hands-free operations in the field.

## Cinematic Experience
The entire UI is built as an immersive, glassmorphic HUD overlaid on a dynamic 3D WebGL cityscape. Inspired by superhero tactical interfaces, it features:
- Sprawling neo-noir cities with volumetric fog and metallic reflections.
- Falling rain particle systems.
- Procedural glowing neon webs mapped geometrically in 3D space.
- Framer Motion driven liquid UI transitions.

## Tech Stack
- Frontend: React 19, TypeScript, Tailwind CSS v4
- 3D Rendering: Three.js, React Three Fiber & Drei
- AI SDK: @google/genai (Gemini 2.0 Flash, Flash-TTS)
- Animations: Framer Motion

## Usage
Add your `GEMINI_API_KEY` to the settings and point the scanner at any crop leaf. The system will handle the rest.
