/**
 * Face Thumbnail Component
 * Fetches and displays a cropped face thumbnail from the backend
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

interface FaceThumbnailProps {
    faceId: number;
    onClick?: () => void;
    selected?: boolean;
    size?: number;
    selectable?: boolean;
    onSelectionChange?: (selected: boolean) => void;
}

export function FaceThumbnail({
    faceId,
    onClick,
    selected,
    size = 80,
    selectable = false,
    onSelectionChange,
}: FaceThumbnailProps) {
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function fetchThumbnail() {
            setIsLoading(true);
            setError(false);

            try {
                const url = await window.api.getFaceThumbnail(faceId);
                if (!cancelled) {
                    setThumbnailUrl(url);
                    setIsLoading(false);
                }
            } catch (err) {
                console.error(`Failed to load thumbnail for face ${faceId}:`, err);
                if (!cancelled) {
                    setError(true);
                    setIsLoading(false);
                }
            }
        }

        fetchThumbnail();

        return () => {
            cancelled = true;
        };
    }, [faceId]);

    const handleClick = () => {
        if (selectable && onSelectionChange) {
            onSelectionChange(!selected);
        } else if (onClick) {
            onClick();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={`
                relative overflow-hidden rounded cursor-pointer 
                transition-all duration-150
                ${selected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-400'}
            `}
            style={{ width: size, height: size }}
        >
            {isLoading ? (
                <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700 animate-pulse flex items-center justify-center">
                    <span className="text-xs text-gray-600 dark:text-gray-500">{faceId}</span>
                </div>
            ) : error || !thumbnailUrl ? (
                <div className="absolute inset-0 bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                    <span className="text-xs text-gray-600 dark:text-gray-500">?</span>
                </div>
            ) : (
                <img
                    src={thumbnailUrl}
                    alt={`Face ${faceId}`}
                    className="w-full h-full object-cover"
                    draggable={false}
                />
            )}
            {/* Selection checkbox overlay */}
            {selectable && (
                <div className={`
                    absolute top-1 right-1 w-5 h-5 rounded-full border-2
                    flex items-center justify-center transition-all
                    ${selected
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-gray-700 dark:bg-gray-800/60 border-gray-500 dark:border-gray-400 hover:border-blue-500 dark:hover:border-blue-400'
                    }
                `}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                </div>
            )}
        </div>
    );
}
