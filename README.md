# Cosmic Audio Visualizer

A transcendent 3D music visualizer that creates an immersive cosmic experience, connecting you deeply to your music.

## Features

- **Cosmic Sphere**: A glowing, shader-based sphere that morphs and pulses with your music
- **Particle Galaxy**: Thousands of particles orbiting and reacting to different frequencies
- **Starfield Background**: Twinkling stars that respond to audio treble
- **Beat Detection**: Real-time beat detection for punchy visual responses
- **Bloom & Post-processing**: Ethereal glow effects for that euphoric feeling
- **Smooth Animations**: Fluid, 60fps animations with gentle camera drift

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. Open the app in your browser
2. Drag and drop an audio file (MP3, WAV, OGG, FLAC)
3. Press play and lose yourself in the visuals
4. Press `Space` to play/pause

## Tech Stack

- **React 18** + TypeScript
- **Three.js** + React Three Fiber
- **Web Audio API** for frequency analysis
- **Custom GLSL Shaders** for visual effects
- **Zustand** for state management
- **Tailwind CSS** for UI styling
- **Vite** for blazing fast development

## Audio Analysis

The visualizer analyzes audio in real-time:
- **Bass** (0-10% of frequency spectrum) → Sphere distortion, particle expansion
- **Mid** (10-50%) → Color shifts, rotation speed
- **Treble** (50-100%) → Star twinkle, fine details
- **Beat Detection** → Pulse effects, camera movement

## License

MIT
