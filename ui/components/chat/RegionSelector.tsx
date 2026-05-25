import { useRef, useEffect, useCallback } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useChatStore } from '../../store/useChatStore';

interface RegionSelectorProps {
    zoom: number;
}

export function RegionSelector({ zoom }: RegionSelectorProps) {
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const isRegionSelectMode = useUIStore((s) => s.isRegionSelectMode);
    const setRegionSelectMode = useUIStore((s) => s.setRegionSelectMode);
    const setPendingRegion = useChatStore((s) => s.setPendingRegion);

    const dragRef = useRef<{ startX: number; startY: number; dragging: boolean }>({
        startX: 0, startY: 0, dragging: false,
    });

    // Clear overlay when mode exits
    useEffect(() => {
        if (!isRegionSelectMode) {
            const canvas = overlayRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx?.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }, [isRegionSelectMode]);

    const drawRect = useCallback((x: number, y: number, w: number, h: number) => {
        const canvas = overlayRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 3]);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = 'rgba(96, 165, 250, 0.08)';
        ctx.fillRect(x, y, w, h);
    }, []);

    const finalize = useCallback((sx: number, sy: number, ex: number, ey: number) => {
        const src = document.querySelector<HTMLCanvasElement>('[data-image-canvas="true"]');
        if (!src) return;

        const left = Math.min(sx, ex);
        const top = Math.min(sy, ey);
        const w = Math.abs(ex - sx);
        const h = Math.abs(ey - sy);
        if (w < 4 || h < 4) return;

        // Map overlay pixel coords → source canvas coords (divide by zoom)
        const srcX = Math.round(left / zoom);
        const srcY = Math.round(top / zoom);
        const srcW = Math.round(w / zoom);
        const srcH = Math.round(h / zoom);

        const tmp = document.createElement('canvas');
        tmp.width = srcW;
        tmp.height = srcH;
        const ctx = tmp.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(src, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
        const base64 = tmp.toDataURL('image/jpeg', 0.85);

        setPendingRegion({ x: left, y: top, width: w, height: h, base64 });
        setRegionSelectMode(false);
    }, [zoom, setPendingRegion, setRegionSelectMode]);

    const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isRegionSelectMode) return;
        const rect = overlayRef.current!.getBoundingClientRect();
        dragRef.current = {
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top,
            dragging: true,
        };
    }, [isRegionSelectMode]);

    const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dragRef.current.dragging) return;
        const rect = overlayRef.current!.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        drawRect(
            dragRef.current.startX,
            dragRef.current.startY,
            cx - dragRef.current.startX,
            cy - dragRef.current.startY,
        );
    }, [drawRect]);

    const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!dragRef.current.dragging) return;
        dragRef.current.dragging = false;
        const rect = overlayRef.current!.getBoundingClientRect();
        finalize(
            dragRef.current.startX,
            dragRef.current.startY,
            e.clientX - rect.left,
            e.clientY - rect.top,
        );
    }, [finalize]);

    // Size overlay to match the image canvas
    const src = document.querySelector<HTMLCanvasElement>('[data-image-canvas="true"]');
    const canvasW = src ? src.offsetWidth : 0;
    const canvasH = src ? src.offsetHeight : 0;

    return (
        <canvas
            ref={overlayRef}
            width={canvasW}
            height={canvasH}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: isRegionSelectMode ? 'auto' : 'none',
                cursor: isRegionSelectMode ? 'crosshair' : 'default',
                zIndex: 10,
            }}
        />
    );
}
