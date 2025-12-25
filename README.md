# Electron Image Editor

A desktop image editor built with Electron, Vite, React, and TypeScript. Supports viewing and converting RAW image formats.

## Features

- **Workspace Management**: Open folders to view images.
- **File Explorer**: Sidebar listing supported image files.
- **RAW Support**: Automatically converts and previews RAW files (CR2, ARW, DNG, etc.) using `sharp`.
- **Image Preview**: Fast preview of images.

## Technology Stack

- **Electron**: Desktop application framework
- **Vite**: Fast build tool and dev server
- **React**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **Sharp**: High-performance image processing

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the App

To start the application in development mode (with hot reloading):

```bash
npm run dev
```

This will start the Vite development server and launch the Electron window.

### Building for Production

To build the application for production (creates a distributable):

```bash
npm run build
```

The output will be in the `dist` and `dist-electron` directories.
