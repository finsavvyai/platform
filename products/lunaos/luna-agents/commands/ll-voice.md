---
name: ll-voice
displayName: Luna Voice (Voicebox)
description: Local voice synthesis using Voicebox — open-source ElevenLabs alternative with voice cloning, 23 languages, 5 TTS engines
version: 2.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: text
    type: string
    description: Text to synthesize into speech
    required: true
    prompt: true
  - name: voice
    type: string
    description: "Voice model to use (default: onyx)"
    required: false
    default: onyx
  - name: language
    type: string
    description: "Language code — 23 supported (default: en)"
    required: false
    default: en
  - name: output
    type: string
    description: "Output format: mp3, wav, ogg, flac (default: mp3)"
    required: false
    default: mp3
mcp_servers:
  - memory
  - git
prerequisites:
  - name: voicebox
    check: "curl -s http://localhost:17493/health"
    install: "See https://github.com/jamiepine/voicebox for setup"
    optional: true
---

# /voice — Local Voice Synthesis with Voicebox

Generate speech locally using Voicebox, an open-source ElevenLabs alternative. Clone voices from audio samples, synthesize in 23 languages with 5 TTS engines. Falls back to OpenAI TTS if Voicebox is not running.

## What It Does

```
/voice "Deploy completed successfully"
    │
    ├── CHECK: Voicebox running at localhost:17493?
    │   ├── YES → Use local Voicebox REST API
    │   └── NO  → Fall back to OpenAI TTS API
    │
    ├── SYNTHESIZE
    │   ├── Select voice model (onyx, alloy, nova, shimmer, echo, or cloned)
    │   ├── Apply language settings (23 languages)
    │   ├── Route through TTS engine (Piper, Coqui, XTTS, VITS, Bark)
    │   └── Generate audio buffer
    │
    └── OUTPUT
        ├── Save to file (mp3/wav/ogg/flac)
        ├── Stream to stdout for piping
        └── Print duration and file path
```

## How It Works

1. **Local-first**: Voicebox runs as a local REST server at `localhost:17493`
2. **Voice cloning**: Provide a 10-30 second audio sample to clone any voice
3. **Multi-engine**: 5 TTS engines — choose quality vs speed tradeoff
4. **Fallback**: If Voicebox is not running, routes through OpenAI TTS API
5. **Zero cost**: All local synthesis is free and offline-capable

## Supported Languages

```
en, es, fr, de, it, pt, nl, pl, ru, zh, ja, ko,
ar, hi, tr, sv, da, no, fi, cs, el, ro, hu
```

## Voice Cloning

```bash
/voice clone --sample ./my-voice-sample.wav    # Create voice clone
/voice "Hello world" --voice my-clone          # Use cloned voice
```

Provide a 10-30 second clean audio sample. Voicebox creates a voice profile stored locally. Use it across all synthesis commands.

## Usage

```bash
/voice "Welcome to LunaOS"                              # Default voice (onyx), English
/voice "Bonjour le monde" --language fr --voice nova     # French synthesis
/voice "Deploy complete" --output wav                    # WAV output
/voice "$(cat README.md)" --voice shimmer                # Narrate your README
```

## Use Cases

| Use Case | Command |
|----------|---------|
| Narrate demos | `/voice "Feature walkthrough" --voice onyx` |
| Add voice to recordings | `/pipe flow-record >> voice "narration text"` |
| Podcast intros | `/voice "Welcome to the LunaOS podcast" --voice alloy` |
| Accessibility audio | `/voice "$(cat docs/guide.md)" --output mp3` |
| Multi-language demos | `/voice "Hola mundo" --language es` |

## Output Structure

```
voice-output/
├── output.mp3          # Generated audio file
├── metadata.json       # Duration, voice, engine, language
└── transcript.txt      # Original text input
```

## In Pipes

```bash
/pipe ghost blog "topic" >> voice "$content" >> publish            # Blog with audio
/pipe docs >> voice "$(cat docs/guide.md)" >> record               # Docs narration
/pipe flow-record "demo" >> voice "walkthrough" >> video            # Demo + narration
/pipe voice "intro" >> sing "outro" >> publish podcast              # Podcast assembly
```

## Engine Selection

| Engine | Quality | Speed | VRAM |
|--------|---------|-------|------|
| Piper | Good | Fast | None |
| VITS | Good | Fast | 1 GB |
| Coqui | Great | Medium | 2 GB |
| XTTS | Excellent | Slow | 4 GB |
| Bark | Excellent | Slow | 6 GB |

## Reference

- Voicebox: https://github.com/jamiepine/voicebox
- Fallback: OpenAI TTS API (requires OPENAI_API_KEY)
