import { useState } from 'react';
import { X, Save, Play, Trash2, Loader2 } from 'lucide-react';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { useChatStore } from '../../store/useChatStore';
import { useEditStore } from '../../store/useEditStore';
import { useLibraryStore } from '../../store/useLibraryStore';
import { unflattenAdjustments } from '../../utils/adjustments';
import type { MaigeRecipe, FlatAdjustments } from '../../../shared/types';

interface RecipeManagerProps {
    onClose: () => void;
    selectedImagePath: string | null;
}

export function RecipeManager({ onClose, selectedImagePath }: RecipeManagerProps) {
    const [recipes, setRecipes] = useState<Array<{ path: string; recipe: MaigeRecipe }>>([]);
    const [saving, setSaving] = useState(false);
    const [applying, setApplying] = useState<string | null>(null);
    const [recipeName, setRecipeName] = useState('');

    const messages = useChatStore((s) => s.messages);
    const setAdjustments = useEditStore((s) => s.setAdjustments);
    const selectedIds = useLibraryStore((s) => s.selectedImageIds);
    const images = useLibraryStore((s) => s.images);

    // Collect steps from chat messages that have adjustments
    const chatSteps = messages
        .filter((m) => m.role === 'assistant' && m.adjustments)
        .map((m) => ({
            instruction: m.content,
            adjustments: m.adjustments as FlatAdjustments,
        }));

    const saveRecipe = async () => {
        if (!recipeName.trim() || chatSteps.length === 0) return;
        setSaving(true);
        try {
            const recipe: MaigeRecipe = {
                version: 1,
                name: recipeName.trim(),
                createdAt: new Date().toISOString(),
                steps: chatSteps,
            };
            const filePath = await saveDialog({
                defaultPath: `${recipe.name}.maige-recipe`,
                filters: [{ name: 'Maige Recipe', extensions: ['maige-recipe'] }],
            });
            if (filePath) {
                await writeTextFile(filePath, JSON.stringify(recipe, null, 2));
            }
        } finally {
            setSaving(false);
        }
    };

    const loadRecipe = async () => {
        const filePaths = await openDialog({
            multiple: true,
            filters: [{ name: 'Maige Recipe', extensions: ['maige-recipe'] }],
        });
        if (!filePaths) return;
        const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
        const loaded: Array<{ path: string; recipe: MaigeRecipe }> = [];
        for (const p of paths) {
            try {
                const text = await readTextFile(p);
                const recipe = JSON.parse(text) as MaigeRecipe;
                loaded.push({ path: p, recipe });
            } catch {
                // skip invalid files
            }
        }
        setRecipes((prev) => [...prev, ...loaded]);
    };

    const applyRecipe = async (recipe: MaigeRecipe) => {
        if (!selectedImagePath && selectedIds.size === 0) return;
        setApplying(recipe.name);
        try {
            const targets: string[] = selectedIds.size > 0
                ? images
                    .filter((img) => selectedIds.has(img.id))
                    .map((img) => img.file_path)
                : selectedImagePath ? [selectedImagePath] : [];

            for (const path of targets) {
                // Apply steps sequentially — last step wins for each field
                const merged = recipe.steps.reduce<FlatAdjustments>(
                    (acc, step) => ({ ...acc, ...step.adjustments }),
                    {
                        exposure: 0, contrast: 0, highlights: 0, shadows: 0,
                        whites: 0, blacks: 0, temperature: 0, tint: 0,
                        saturation: 0, vibrance: 0,
                    },
                );
                setAdjustments(path, unflattenAdjustments(merged));
            }
        } finally {
            setApplying(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
            <div
                className="bg-[#1e1e1e] rounded-lg border border-[#333] w-[480px] max-h-[70vh] flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
                    <h2 className="text-sm font-semibold text-white">Recipes</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Save current chat as recipe */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Save current chat as recipe
                        </h3>
                        {chatSteps.length === 0 ? (
                            <p className="text-xs text-gray-600">No AI edits in the current chat to save.</p>
                        ) : (
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={recipeName}
                                    onChange={(e) => setRecipeName(e.target.value)}
                                    placeholder="Recipe name…"
                                    className="flex-1 bg-[#2a2a2a] text-white text-xs rounded border border-[#444] px-2 py-1.5 focus:outline-none focus:border-blue-500 placeholder-gray-600"
                                />
                                <button
                                    onClick={saveRecipe}
                                    disabled={saving || !recipeName.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs text-white transition-colors"
                                >
                                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                    Save
                                </button>
                            </div>
                        )}
                        {chatSteps.length > 0 && (
                            <p className="text-xs text-gray-500">{chatSteps.length} step{chatSteps.length !== 1 ? 's' : ''} from current chat</p>
                        )}
                    </div>

                    {/* Load & apply recipes */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Loaded recipes</h3>
                            <button
                                onClick={loadRecipe}
                                className="text-xs text-blue-400 hover:text-blue-300"
                            >
                                + Load recipe file
                            </button>
                        </div>
                        {recipes.length === 0 && (
                            <p className="text-xs text-gray-600">No recipes loaded. Click "Load recipe file" to open a .maige-recipe file.</p>
                        )}
                        {recipes.map(({ path, recipe }) => (
                            <div key={path} className="flex items-center gap-2 bg-[#2a2a2a] rounded px-3 py-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white truncate">{recipe.name}</p>
                                    <p className="text-xs text-gray-500">{recipe.steps.length} step{recipe.steps.length !== 1 ? 's' : ''}</p>
                                </div>
                                <button
                                    onClick={() => applyRecipe(recipe)}
                                    disabled={applying === recipe.name}
                                    title={selectedIds.size > 0 ? `Apply to ${selectedIds.size} selected images` : 'Apply to current image'}
                                    className="flex items-center gap-1 px-2 py-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 rounded text-xs text-white transition-colors"
                                >
                                    {applying === recipe.name
                                        ? <Loader2 size={11} className="animate-spin" />
                                        : <Play size={11} />}
                                    {selectedIds.size > 0 ? `Apply (${selectedIds.size})` : 'Apply'}
                                </button>
                                <button
                                    onClick={() => setRecipes((prev) => prev.filter((r) => r.path !== path))}
                                    className="text-gray-600 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
