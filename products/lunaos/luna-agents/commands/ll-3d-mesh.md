---
name: ll-3d-mesh
displayName: Luna 3D Mesh
description: Generate 3D meshes from text descriptions using LLaMA-Mesh — text-to-3D for marketing heroes, product visuals, and icons
version: 1.0.0
category: creative
agent: luna-task-executor
parameters:
  - name: prompt
    type: string
    description: "What to generate (e.g., 'a diamond-shaped rotating cube', 'a stylized rocket', 'a 3D logo')"
    required: true
    prompt: true
  - name: format
    type: string
    description: "Output: obj, html-preview, css-cube, video-loop"
    required: false
    default: html-preview
prerequisites: []
---

# Luna 3D Mesh — Text-to-3D Generation

Generate 3D meshes from text descriptions using NVIDIA's LLaMA-Mesh model, then export as OBJ files, embeddable HTML previews, CSS-only cubes, or looping video for marketing heroes.

## How It Works

LLaMA-Mesh is a fine-tuned LLaMA model that generates 3D mesh vertex coordinates and face definitions as plain text. No special vocabulary — it outputs OBJ-format mesh data directly.

### Step 1: Generate Mesh
Sends your prompt to LLaMA-Mesh (via HuggingFace Inference API or local model) to generate the 3D mesh as text.

### Step 2: Convert to Format
- **obj** — Raw OBJ file for Blender/Three.js
- **html-preview** — Embeddable Three.js viewer with auto-rotation
- **css-cube** — CSS-only rotating cube with mesh faces as textures
- **video-loop** — Renders a rotating loop as MP4 (for marketing heroes)

## Usage

```bash
# Generate a 3D diamond for marketing hero
/3d-mesh "a faceted diamond shape with sharp edges" html-preview

# Generate an icon mesh
/3d-mesh "a stylized rocket ship" obj

# Generate a rotating cube hero (like HeyGen)
/3d-mesh "a cube with rounded edges" css-cube

# Generate a video loop for landing page
/3d-mesh "an abstract geometric orb" video-loop
```

## Marketing Hero Pattern (HeyGen-style)

The rotating cube/diamond hero on HeyGen's landing page is a pre-rendered video loop. To replicate:

```bash
# Option 1: CSS-only rotating diamond (zero runtime cost)
/3d-mesh "diamond" css-cube

# Option 2: Generate mesh, render as video loop
/3d-mesh "faceted orb with holographic edges" video-loop
```

The CSS cube approach produces this pattern:
- `rotateZ(45deg)` + `rotateX(-20deg)` = diamond orientation
- 6 faces, each holding a product screenshot or avatar
- Iridescent edge glow via `box-shadow`
- 8-second rotation loop

## Output

```
.luna/{project}/3d-mesh/
  mesh.obj                # Raw 3D mesh
  preview.html            # Embeddable Three.js viewer
  cube.html               # CSS rotating cube
  loop.mp4                # Video loop for hero sections
  textures/               # Generated face textures
```

## In Pipes

```bash
# Generate 3D hero, then build landing page
/pipe 3d-mesh "diamond orb" css-cube >> heygen https://myapp.com

# Generate mesh for product visualization
/pipe 3d-mesh "my product shape" html-preview >> docs
```

Sources: [LLaMA-Mesh (NVIDIA)](https://github.com/nv-tlabs/LLaMA-Mesh), [HuggingFace Space](https://huggingface.co/spaces/Zhengyi/LLaMA-Mesh), [Paper](https://huggingface.co/papers/2411.09595)
