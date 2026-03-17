# Contributing to Maige

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (latest stable)
- Platform-specific Tauri dependencies — see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Getting Started

```bash
git clone https://github.com/dileeppandey/maige.git
cd maige
npm install
npm run tauri:dev
```

## Making Changes

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Run `npm run lint` to check for lint errors
4. Run `npm run build` to verify TypeScript compiles
5. Test manually with `npm run tauri:dev`
6. Commit with a clear message describing the change
7. Open a pull request against `main`

## Project Structure

See [CLAUDE.md](./CLAUDE.md) for architecture details and key files.

## Code Style

- TypeScript for frontend, Rust for backend
- Frontend uses React functional components with hooks
- State management via Zustand stores in `src/store/`
- Tauri IPC calls go through `src/bridge.ts` — don't call `invoke()` directly from components
- Use `assetUrl()` from `src/utils/assetUrl.ts` for local file URLs — never use raw file paths

## Reporting Issues

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- OS and version
- Screenshots if applicable

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
