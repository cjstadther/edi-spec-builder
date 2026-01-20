# EDI Specification Builder

A desktop application for creating, editing, and exporting ANSI X12 EDI implementation specifications.

## Features

- Create and edit EDI specifications for any X12 transaction set
- Hierarchical editing of loops, segments, and elements
- Import specifications from EdiNation OpenEDI format
- Define usage requirements (Mandatory, Optional, Conditional)
- Set cardinality constraints (min/max repeats)
- Create variants with discriminator rules
- Add code value restrictions to elements
- Include EDI examples with annotations
- Export to professional PDF documentation
- Save/load specifications as JSON

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Run in Development Mode

```bash
npm run dev
```

This starts the webpack dev server and Electron concurrently.

### Run Tests

```bash
npm test
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

## Building for Distribution

### Build for Current Platform

```bash
npm run package
```

### Build for Specific Platforms

```bash
# Windows (.exe installer)
npx electron-builder --win

# macOS (.dmg)
npx electron-builder --mac

# Linux (.AppImage)
npx electron-builder --linux

# Multiple platforms
npx electron-builder --win --mac
```

Built installers are output to the `release/` directory.

### Cross-Platform Building

| Building From | Can Build For |
|---------------|---------------|
| Windows       | Windows, Mac* |
| macOS         | macOS, Windows |
| Linux/WSL     | Linux, Windows |

*Mac builds from Windows require additional setup or a CI service.

### Building with Docker

You can use Docker to build for Linux and Windows from any platform. This uses the official [electronuserland/builder](https://hub.docker.com/r/electronuserland/builder) images.

**Build for Linux:**

```bash
docker run --rm -it \
  -v ${PWD}:/project \
  -v ${PWD##*/}-node-modules:/project/node_modules \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  electronuserland/builder:wine \
  /bin/bash -c "npm install && npm run build && npx electron-builder --linux"
```

**Build for Windows (from Linux/macOS):**

```bash
docker run --rm -it \
  -v ${PWD}:/project \
  -v ${PWD##*/}-node-modules:/project/node_modules \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  electronuserland/builder:wine \
  /bin/bash -c "npm install && npm run build && npx electron-builder --win"
```

**Build for both Linux and Windows:**

```bash
docker run --rm -it \
  -v ${PWD}:/project \
  -v ${PWD##*/}-node-modules:/project/node_modules \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  electronuserland/builder:wine \
  /bin/bash -c "npm install && npm run build && npx electron-builder --linux --win"
```

> **Note:** macOS builds cannot be created in Docker due to licensing restrictions. Use a Mac or a CI service like GitHub Actions for macOS builds.

See the [electron-builder Docker documentation](https://www.electron.build/multi-platform-build#docker) for more details.

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── main.ts     # Application entry point
│   ├── preload.ts  # Secure IPC bridge
│   └── pdf-generator.ts
├── renderer/       # React frontend
│   ├── App.tsx
│   ├── components/
│   └── styles/
└── shared/         # Shared types and utilities
    ├── models/
    └── utils/
```

## Importing Specifications

The application supports importing specifications from:

1. **EdiNation OpenAPI format** - Download from [EDI Nation Spec Library](https://edination.edifabric.com/edi-spec-library.html) and import via File > Import OpenEDI

## License

MIT
