<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1kw35HbTjuMHW1sGrYs7NWRg5oyIgGUHj

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Configure local model endpoints in `.env.local` (see below).
3. Run the app:
   `npm run dev`

## Local model configuration

This project is now fully local-first. It does **not** call any external APIs. Instead, it talks to locally hosted model servers over HTTP (for example, OpenAI-compatible endpoints exposed by vLLM, llama.cpp, or a custom gateway that wraps ComfyUI/Stable Diffusion).

Add the following to `.env.local`:

```
# Text/vision chat endpoint (OpenAI-compatible)
VITE_LOCAL_TEXT_API_BASE=http://localhost:8000
VITE_LOCAL_TEXT_MODEL=qwen2.5-72b-instruct
VITE_LOCAL_VISION_MODEL=qwen2.5-vl

# Image generation/editing endpoint (OpenAI-compatible images API)
VITE_LOCAL_IMAGE_API_BASE=http://localhost:8001
VITE_LOCAL_IMAGE_MODEL=qwen-image-edit

# Optional if your local servers require auth
VITE_LOCAL_API_KEY=your-local-token
```

### Suggested local stack

- **Text / vision (Qwen 2.5 72B + VLM):**
  - Run a local OpenAI-compatible server such as **vLLM** for Qwen 2.5 72B Instruct.
  - If you need image understanding (style suggestions, presentation text), add a vision-capable model such as **Qwen2.5-VL** or **LLaVA** behind the same `/v1/chat/completions` API.

- **Image generation/editing:**
  - Run a local image server that exposes `/v1/images/generations` and `/v1/images/edits` (OpenAI-compatible). This can be a lightweight gateway over **ComfyUI**, **Stable Diffusion WebUI**, or **Diffusers**.
  - The app sends `image` (base image), `mask` (optional), and `reference_image` (optional) via `multipart/form-data` for edits.

> Tip: If you already have a local gateway, just point `VITE_LOCAL_*` to it. No cloud dependency is required.
