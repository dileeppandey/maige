import { useState } from "react";
import { Type } from "lucide-react";

const FONT_FAMILIES = [
  "Flexible Display",
  "Inter",
  "Roboto",
  "Playfair Display",
  "Montserrat",
];

const FONT_STYLES = ["Regular", "Bold", "Italic", "Bold Italic"];

const inputClass =
  "w-full bg-white dark:bg-[#1a1a1a] border border-gray-300 dark:border-[#333] rounded px-2 py-1.5 text-xs text-gray-900 dark:text-gray-200 outline-none focus:border-[#C8A951]";

const labelClass = "text-xs text-gray-600 dark:text-gray-400 uppercase font-semibold";

export function TextOverlayPanel() {
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontStyle, setFontStyle] = useState("Regular");
  const [size, setSize] = useState(48);
  const [weight, setWeight] = useState(400);
  const [color, setColor] = useState("#ffffff");

  return (
    <div className="h-full bg-gray-50 dark:bg-[#252525] border-r border-gray-300 dark:border-[#333] flex flex-col">
      <div className="h-10 flex items-center gap-2 px-4 border-b border-gray-300 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shrink-0">
        <Type className="w-4 h-4 text-[#C8A951]" />
        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">Text Overlay</span>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <div className="space-y-1.5">
          <label className={labelClass}>Font Family</label>
          <select
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className={inputClass}
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Style</label>
          <select
            value={fontStyle}
            onChange={(e) => setFontStyle(e.target.value)}
            className={inputClass}
          >
            {FONT_STYLES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className={labelClass}>Size</label>
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              min={1}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass}>Weight</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              min={100}
              max={900}
              step={100}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelClass}>Color</label>
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#ffffff"
            className={inputClass}
          />
        </div>
      </div>
    </div>
  );
}
