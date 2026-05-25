---
name: ll-sing
displayName: Luna Sing
description: Generate songs and soundtracks about your code, product, or any topic — with Suno AI, ElevenLabs, and fal.ai
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: about
    type: string
    description: What the song should be about — product name, feature, code, mood, or any topic
    required: true
    prompt: true
  - name: style
    type: string
    description: "Genre: pop, rock, electronic, jazz, hip-hop, cinematic, lo-fi, ambient, custom"
    required: false
    default: pop
  - name: type
    type: string
    description: "Type: song (full with lyrics), jingle (short product jingle), soundtrack (instrumental), narration (voiceover)"
    required: false
    default: song
mcp_servers:
  - suno
  - elevenlabs
  - fal-ai
  - git
  - memory
---

# /sing — Your Code Has a Soundtrack

Generate original music about your product, feature launches, team celebrations, or literally anything. Full songs with lyrics, product jingles, cinematic soundtracks, or narrated voiceovers.

## What Luna Creates

```
/sing "LunaOS just hit 10,000 users" --style electronic --type song
              │
              ▼
   CONTEXT (reads your codebase)
   ├── Product name, description, mission
   ├── Recent achievements (git log)
   ├── Team energy (commits, merged PRs)
   └── Brand voice from design system
              │
              ▼
   COMPOSE
   ├── Write lyrics that tell YOUR story
   ├── Match style to your brand personality
   ├── Structure: verse, chorus, bridge
   └── Include technical references (tastefully!)
              │
              ▼
   GENERATE (parallel)
   ├── Suno: full song with vocals
   ├── ElevenLabs: narrated version (your voice clone)
   ├── fal-ai: instrumental variation
   └── Multiple takes for selection
              │
              ▼
   OUTPUT
   ├── song.mp3 (full song)
   ├── lyrics.md (full lyrics)
   ├── jingle-30s.mp3 (30-second cut)
   ├── instrumental.mp3 (no vocals)
   └── stems/ (individual tracks)
```

## Usage

```bash
/sing "our new billing feature"                            # Pop song about billing
/sing "deploy day celebration" --style rock                # Rock anthem for deploys
/sing "LunaOS" --style cinematic --type soundtrack         # Epic product soundtrack
/sing "onboarding flow" --style lo-fi --type jingle        # Lo-fi jingle for demos
/sing "security audit passed" --style hip-hop              # Victory rap
/sing "we fixed the production bug at 3am" --style blues   # The Blues of DevOps
```

## In Pipes

```bash
/pipe launch production >> sing "we just shipped!" --style electronic
/pipe ghost changelog >> sing "sprint recap" --style pop >> share team
/pipe test >> if $test.pass >> sing "all tests pass" --style jazz
/pipe sing "product demo" --type soundtrack >> record >> publish
```

## Creative Examples

| Prompt | What You Get |
|--------|-------------|
| `"React hooks"` | A catchy pop song explaining useState and useEffect |
| `"our API is fast"` | Electronic banger about sub-100ms latency |
| `"merge conflicts"` | Blues ballad about resolving conflicts at midnight |
| `"v2.0 release"` | Cinematic orchestral piece for your launch video |
| `"the intern's first PR"` | Wholesome folk song about growth |
