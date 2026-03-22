import { useState } from "react";
import {
  X,
  Eye,
  EyeOff,
  GripVertical,
  Sparkles,
  Paintbrush,
  Crop,
  Image,
} from "lucide-react";

interface Layer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
}

interface LayersPanelProps {
  onClose: () => void;
  layers?: Layer[];
}

const DEFAULT_LAYERS: Layer[] = [
  { id: "ai-enhance", name: "AI Enhancement", type: "ai", visible: true },
  { id: "brush-adj", name: "Brush Adjustment", type: "brush", visible: true },
  { id: "crop", name: "Crop", type: "crop", visible: true },
  { id: "original", name: "Original (base)", type: "original", visible: true },
];

const LAYER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ai: Sparkles,
  brush: Paintbrush,
  crop: Crop,
  original: Image,
};

export function LayersPanel({ onClose, layers }: LayersPanelProps) {
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>(
    () => {
      const items = layers ?? DEFAULT_LAYERS;
      return Object.fromEntries(items.map((l) => [l.id, l.visible]));
    }
  );

  const items = layers ?? DEFAULT_LAYERS;

  const toggleVisibility = (id: string) => {
    setVisibilityMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="bg-gray-50 dark:bg-[#252525] border-l border-gray-300 dark:border-[#333] flex flex-col h-full">
      <div className="h-10 flex items-center justify-between px-4 border-b border-gray-300 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shrink-0">
        <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">Layers</span>
        <button
          onClick={onClose}
          className="text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {items.map((layer) => {
          const IconComponent = LAYER_ICONS[layer.type] ?? Image;
          const isOriginal = layer.type === "original";
          const isVisible = visibilityMap[layer.id] ?? layer.visible;

          return (
            <div
              key={layer.id}
              className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] border-b border-gray-300 dark:border-[#333]/50 ${
                isOriginal ? "opacity-60" : ""
              }`}
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-600 dark:text-gray-500 shrink-0 cursor-grab" />
              <IconComponent className="w-4 h-4 text-gray-600 dark:text-gray-400 shrink-0" />
              <span className="text-xs text-gray-800 dark:text-gray-200 flex-1 truncate">
                {layer.name}
              </span>
              <button
                onClick={() => toggleVisibility(layer.id)}
                className="text-gray-600 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors shrink-0"
              >
                {isVisible ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
