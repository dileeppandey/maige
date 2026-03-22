interface AIProcessingOverlayProps {
  isProcessing: boolean;
  message?: string;
  progress?: number;
}

export function AIProcessingOverlay({
  isProcessing,
  message = "Enhancing Colors",
  progress,
}: AIProcessingOverlayProps) {
  if (!isProcessing) return null;

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-3">
        {progress != null ? (
          <div className="w-[200px] h-1.5 bg-[#333] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C8A951] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full bg-[#C8A951] animate-pulse"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-[#C8A951] animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-[#C8A951] animate-pulse"
              style={{ animationDelay: "600ms" }}
            />
          </div>
        )}

        <p className="text-sm text-[#C8A951]">
          AI Processing &mdash; {message}
        </p>

        {progress != null && (
          <span className="text-xs text-gray-400">{Math.round(progress)}%</span>
        )}
      </div>
    </div>
  );
}
