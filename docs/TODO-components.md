# Component Design TODO

Based on "Buttons & Actions" and "Tool Actions & Effects" design specs.

---

## Buttons & Actions

### 1. Primary CTA Buttons
- [ ] Standardize gold-filled primary buttons (Export, Import, Apply, Save)
- [ ] States: Default (gold fill, dark text), Hover (lighter gold), Active/Pressed (brighter), Disabled (dimmed)
- [ ] Variants: Text-only, Icon+Text (wide), Small (compact), Top Bar Size, Icon-Only (send)
- [ ] Update existing: Import button, Apply All button, Save Configuration button, Apply to N Photos button

### 2. Secondary (Outline) Buttons
- [ ] Border stroke, no fill — for Cancel, Undo, and lower-priority paired actions
- [ ] States: Default (border only), Hover (filled dark), Active/Pressed (filled), Disabled (dimmed)
- [ ] Compact variant for Undo
- [ ] Update existing: Cancel buttons in modals, Undo button in AI chat

### 3. Ghost / Surface Buttons
- [ ] Surface fill + border — for toolbar controls (Config, Sort, Zoom, View)
- [ ] States: Default, Hover (lighter), Active/Pressed, Disabled
- [ ] Variants: Zoom Controls (Fit), Sort Control (Date), Icon-Only (View), Minimal (no border, History), Toggle Action (Before/After)
- [ ] Update existing: gallery header filter/date/sort buttons, Config button in AI panel

### 4. Tool Bar Icons
- [ ] 40x40 icon containers (currently 36px — increase to 40px)
- [ ] States: Default (gray), Hover (light bg), Active/Selected (white icon), AI Tool Active (gold icon + gold tint background), Disabled
- [ ] AI tool specifically gets gold background tint when active
- [ ] Update existing ToolSidebar component

### 5. Toggle Switches
- [ ] 36x20 pill toggles for AI Config modal
- [ ] States: On (gold), Off (gray), On Hover, Off Hover, Disabled
- [ ] Update existing toggles in AIConfigModal

### 6. Filter Chips
- [ ] Pill-shaped filters for Library view (All, Edited, RAW, AI Enhanced)
- [ ] Active chip: gold fill with dark text
- [ ] Default: border only, gray text
- [ ] Hover: lighter border
- [ ] "AI Enhanced" chip should include sparkle icon
- [ ] Update existing filter tabs in ImagePreview gallery header

### 7. Navigation Items
- [ ] Sidebar nav rows with gold tint background when active
- [ ] Active: gold-tinted background, white text, count badge
- [ ] Default: no background, gray text
- [ ] Hover: subtle highlight
- [ ] Already mostly implemented in LibraryPanel — verify styling matches exactly

### 8. AI Accent & Special Buttons
- [ ] Gold-tinted buttons with sparkle icon for AI Batch Edit
- [ ] Distinct from Primary CTA — uses border + subtle gold tint
- [ ] States: Default, Hover, Active/Pressed, Disabled
- [ ] Update existing AI Batch Edit button in gallery

### 9. Adjustment Chips & Operation Items
- [ ] Small inline indicators for AI-applied adjustments (chat panel)
- [ ] Green-tinted chip with icon (e.g., "Vibrance +35")
- [ ] Operation items: selectable rows with checkmark (batch panel)
- [ ] Update existing AdjustmentChip in AIEditorPanel
- [ ] Update operation items in AIBatchEditPanel

---

## Tool Actions & Effects

### 1. Crop & Rotate Tool
- [ ] Floating options bar above canvas: Aspect Ratio chips (Freeform, 16:9, 4:5, 1:1, Original), Rotate button, Flip button
- [ ] Crop overlay on image with draggable handles and rule-of-thirds grid
- [ ] Bottom action bar: Apply (gold primary CTA) + Cancel (outline secondary)
- [ ] Tool sidebar shows crop icon active (white)
- [ ] New component: `CropToolbar` and `CropOverlay`

### 2. Adjustment Brush Tool
- [ ] Floating panel next to toolbar with Brush Settings: Size, Opacity, Flow, Feather sliders
- [ ] "Show Mask Overlay" toggle switch
- [ ] Brush cursor on canvas (circle showing size/feather)
- [ ] Semi-transparent red mask overlay on painted areas
- [ ] New component: `BrushSettingsPanel`

### 3. Heal / Clone Tool
- [ ] Tool panel with Heal/Clone toggle (tab-style switcher)
- [ ] Brush Size slider and Softness slider
- [ ] Source point indicator on canvas
- [ ] New component: `HealClonePanel`

### 4. Mask / Selection Tool
- [ ] Three mode tabs: Brush, Pen, AI
- [ ] AI Mask Prompt input ("Select the sky")
- [ ] "Invert Selection" toggle
- [ ] Marching ants selection border on canvas
- [ ] New component: `MaskSelectionPanel`

### 5. Text Overlay Tool
- [ ] Text settings panel: Font Family dropdown, Style dropdown (Bold, etc.), Size input, Weight input
- [ ] Draggable text box on canvas with resize handles
- [ ] New component: `TextOverlayPanel`

### 6. Layers Panel
- [ ] Layer list showing layer stack: AI Enhancement, Brush Adjustment, Crop, Original (base)
- [ ] Each layer row with visibility toggle (eye icon), layer name, drag handle
- [ ] Close button on panel
- [ ] New component: `LayersPanel`

### 7. AI Tool — Sparkles (Chat Panel)
- [ ] Already implemented as AIEditorPanel
- [ ] Design shows: "AI Assistant" header, welcome message with suggestions
- [ ] Processing state: amber progress bar on image ("AI Processing — Enhancing Colors")
- [ ] Response shows: text + amber "Enhancing sunset warmth and saturation..." status
- [ ] Verify chat UI matches design details (avatar, bubble styling)
- [ ] Add AI processing overlay on the image canvas during processing
