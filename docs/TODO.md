# AI Features Implementation TODO

Based on designs in `docs/designs/`. Three connected features: AI Editor (single image), AI Batch Edit (gallery), and AI Config modal.

---

## Overview

The designs introduce an **AI-powered editing layer** on top of the existing adjustment pipeline:
- A conversational chat panel in the editor view where users describe edits in natural language and the AI responds with specific adjustment values
- A batch edit panel in the gallery view to apply AI instructions across multiple selected photos
- A config modal to choose the AI model provider and configure input modes

---

## Feature 1: AI Editor Panel (Single Image)

Conversational panel that replaces or sits alongside the left side of the editor view. User types instructions, AI responds with proposed adjustment values, user applies them.

### UI Components

- [ ] **`src/components/panels/AIEditorPanel.tsx`** — main chat panel
  - Message thread (user messages + AI response cards)
  - AI response card shows proposed adjustments as chips: `Vibrance +55`, `Temp +12`, `Contrast +18`, `HSL Sky`
  - "Apply All" button and "Undo" button per AI response
  - Bottom input bar with:
    - Text input: "Describe what you want to edit..."
    - "Attach" button — attach image file for reference
    - "Reference" button — pick reference image from library
    - "Voice" button — microphone (voice input, Phase 2)

- [ ] **`src/components/adjustments/AIPresets.tsx`** — AI preset cards in the right panel
  - Replace current text dropdown presets with visual card grid
  - Cards: Golden Hour, Cinematic, Moody Dark (and any user-saved presets)
  - Clicking a card applies the preset adjustments

- [ ] Add "Config" button to the editor toolbar (top bar) that opens `AIConfigModal`

- [ ] Add toggle in `useUIStore` to switch right panel between `develop` and `ai` modes, or add a tab switcher at the top of the right panel

### State — `src/store/useAIStore.ts` (new)

```ts
interface AIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposedAdjustments?: Partial<ImageAdjustments>  // parsed from AI response
  applied: boolean
  timestamp: string
}

interface AIState {
  messages: AIMessage[]
  isThinking: boolean
  activeProvider: 'claude' | 'gpt4vision' | 'gemini'
  // actions
  sendMessage: (filePath: string, instruction: string, referenceImage?: string) => Promise<void>
  applyProposal: (messageId: string) => void
  undoProposal: (messageId: string) => void
  clearMessages: () => void
}
```

### Service — `src/services/aiService.ts` (new)

- [ ] `getEditSuggestions(imageBase64, instruction, provider)` → returns structured adjustment values
- [ ] Prompt engineering: instruct the model to respond with JSON containing adjustment keys matching `ImageAdjustments` shape
- [ ] Parse AI response: extract `light` and `color` adjustment values from the model's JSON output
- [ ] Handle API errors gracefully (show error message in chat)

### Integration

- [ ] When user hits Send in AIEditorPanel:
  1. Encode current image to base64 (use Tauri `readFile` via bridge)
  2. Call `aiService.getEditSuggestions()`
  3. Parse returned adjustments, display as chips in the AI message card
- [ ] "Apply All" → calls `useEditStore.setAdjustments()` with the merged proposed values
- [ ] "Undo" → reverts to the adjustments before the proposal was applied

---

## Feature 2: AI Batch Edit Panel (Gallery View)

Slide-in right panel in the gallery view for applying AI-driven edits to multiple selected photos.

### UI Components

- [ ] **`src/components/panels/AIBatchEditPanel.tsx`**
  - Header: "AI Batch Edit" with close (×) button
  - Selected photos thumbnails strip (top)
  - "Batch Instructions" textarea: free-text field for describing the edit goal
  - "Operations" checklist:
    - Color Grading
    - Auto Enhance
    - Noise Reduction *(Phase 2 — needs Rust backend)*
    - Smart Crop *(Phase 2 — needs Rust backend)*
  - "Apply to N Photos" primary button

- [ ] Add "AI Batch Edit" button to the gallery toolbar (top bar, next to Import), visible when photos are selected
- [ ] Add `AI Enhanced` filter tab alongside `All`, `Edited`, `RAW` in the gallery header

- [ ] Add "AI Enhanced" collection to the left sidebar in `LibraryPanel` — filters to images that have had AI edits applied

### State additions to `useAIStore`

```ts
interface AIBatchState {
  isBatchProcessing: boolean
  batchProgress: { current: number; total: number }
  batchInstruction: string
  batchOperations: {
    colorGrading: boolean
    autoEnhance: boolean
    noiseReduction: boolean
    smartCrop: boolean
  }
  // actions
  setBatchInstruction: (text: string) => void
  toggleBatchOperation: (op: keyof batchOperations) => void
  runBatch: (imageIds: number[]) => Promise<void>
}
```

### Service additions

- [ ] `batchEdit(imagePaths, instruction, operations)` — loops over images, sends each to AI, applies returned adjustments, writes to `useEditStore` keyed by path
- [ ] Progress tracking — update `batchProgress` after each image completes

### Database

- [ ] Add `ai_edited` boolean column to `images` table in `database.rs` (set to true when AI adjustments are applied)
- [ ] Add IPC command `mark_ai_edited(imageId)` in `commands.rs`
- [ ] `getImagesByAIEnhanced()` query for the "AI Enhanced" sidebar filter
- [ ] Corresponding bridge method in `src/bridge.ts`

---

## Feature 3: AI Config Modal

Multi-section settings modal for AI provider and input channel configuration.

### UI Component — `src/components/modals/AIConfigModal.tsx`

Left sidebar nav with sections:

- **Model Provider** *(implement first)*
  - Radio list: Claude (Anthropic), GPT-4 Vision (OpenAI), Gemini Pro Vision (Google)
  - Each option shows name, description, and "Active" badge for the selected one
  - Multi-Modal Input Channels toggles:
    - Text Prompts (on by default)
    - Image Reference (on by default)

- **Parameters** *(Phase 2)*
  - Temperature, max tokens, etc.

- **Vision Input** *(Phase 2)*
  - Image resize/compression settings before sending to API

- **Voice Input** *(Phase 2)*
  - Microphone permissions, language selection

- **Text Prompts** *(Phase 2)*
  - System prompt customization

- **API Keys**
  - Secure text inputs for: Anthropic API Key, OpenAI API Key, Google API Key
  - Keys stored via Tauri's secure storage or in app config file (never committed)
  - "Save Configuration" / "Cancel" buttons

### State additions to `useAIStore`

```ts
interface AIConfig {
  provider: 'claude' | 'gpt4vision' | 'gemini'
  inputChannels: {
    textPrompts: boolean
    imageReference: boolean
    voiceInput: boolean
  }
  apiKeys: {
    anthropic: string
    openai: string
    google: string
  }
}
```

### Persistence

- [ ] Save config to Tauri app data dir as `ai-config.json` (exclude `apiKeys` or encrypt)
- [ ] API keys: use OS keychain via a Tauri plugin, or store in a separate `ai-keys.json` in app data (not synced/committed)
- [ ] Load config on app start in `App.tsx`
- [ ] Add `saveAIConfig` / `loadAIConfig` IPC commands in `commands.rs` + bridge

---

## Shared / Infrastructure

### `shared/types.ts` additions

- [ ] `AIMessage` type
- [ ] `AIConfig` type
- [ ] `BatchOperation` type

### `src/bridge.ts` additions

- [ ] `readImageAsBase64(filePath)` — read local file, return base64 string for sending to AI API
- [ ] `saveAIConfig(config)` / `loadAIConfig()`
- [ ] `markImageAIEdited(imageId)`
- [ ] `getAIEnhancedImages()`

### `src/api/aiProviders.ts` (new)

Thin wrappers over each provider's API:
- [ ] `callClaude(base64Image, instruction)` — uses `@anthropic-ai/sdk`
- [ ] `callGPT4Vision(base64Image, instruction)` — uses `openai` npm package
- [ ] `callGemini(base64Image, instruction)` — uses `@google/generative-ai`

All three should return a normalized `Partial<ImageAdjustments>` object.

---

## Implementation Order

1. **AI Config Modal** — no AI calls needed yet, just UI + config persistence
2. **`useAIStore`** — state scaffold with Claude integration only (no batch yet)
3. **AI Editor Panel** — chat UI + Claude API calls + apply adjustments
4. **AI Presets** — visual preset cards in DevelopPanel
5. **AI Batch Edit Panel** — gallery batch UI + progress + DB column
6. **Add GPT-4 Vision and Gemini** providers
7. **Voice input** (Phase 2)
8. **Noise Reduction / Smart Crop** batch ops (Phase 2 — needs Rust)

---

## Notes

- All AI API calls happen from the **frontend** (Tauri webview can make HTTPS requests). No Rust backend changes needed for the API calls themselves.
- Image encoding: use Tauri `readFile` to get raw bytes, then `btoa` or `Uint8Array` → base64 before sending to the API.
- The existing `ImageAdjustments` shape (`light` + `color`) maps cleanly to what the AI should return. Include the field names and ranges in the system prompt so the model produces parseable JSON.
- The existing `presets` in `useEditStore` can be reused for AI-named presets (Golden Hour etc.) — just pre-populate them with known adjustment values rather than requiring the AI.
