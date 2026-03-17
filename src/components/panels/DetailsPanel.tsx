/**
 * Details Panel Component
 * Shows album info (when viewing an album) and image metadata
 */

import { useEffect, useState } from 'react';
import { Folder, Image, Calendar, MapPin, Camera, FileText, Info, Tag, Hash, Aperture, Zap, Palette } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { assetUrl } from '../../utils/assetUrl';

interface ImageDetails {
    id: number;
    file_path: string;
    file_name: string;
    file_hash?: string | null;
    file_size?: number | null;
    width?: number | null;
    height?: number | null;
    format?: string | null;
    color_space?: string | null;
    has_alpha?: number | null;
    date_taken?: string | null;
    date_imported?: string;
    camera_make?: string | null;
    camera_model?: string | null;
    focal_length?: number | null;
    aperture?: number | null;
    iso?: number | null;
    shutter_speed?: string | null;
    exposure_program?: string | null;
    metering_mode?: string | null;
    flash?: string | null;
    white_balance?: string | null;
    gps_lat?: number | null;
    gps_lng?: number | null;
    phash?: string | null;
    auto_tags?: string | null;
    scene_type?: string | null;
    analyzed_at?: string | null;
}

interface DetailsPanelProps {
    selectedImagePath?: string | null;
}

export function DetailsPanel({ selectedImagePath }: DetailsPanelProps) {
    const { viewMode, selectedAlbumId, albums } = useLibraryStore();
    const [imageDetails, setImageDetails] = useState<ImageDetails | null>(null);

    // Get current album if viewing one
    const currentAlbum = viewMode === 'album' && selectedAlbumId
        ? albums.find(a => a.id === selectedAlbumId)
        : null;

    // Load image details when selected image changes
    useEffect(() => {
        const loadDetails = async () => {
            if (!selectedImagePath) {
                setImageDetails(null);
                return;
            }
            try {
                const details = await window.electronAPI.getImageByPath(selectedImagePath);
                setImageDetails(details);
            } catch {
                setImageDetails(null);
            }
        };
        loadDetails();
    }, [selectedImagePath]);

    // Format file size
    const formatFileSize = (bytes?: number | null) => {
        if (!bytes) return null;
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Format date
    const formatDate = (dateString?: string | null, includeTime = true) => {
        if (!dateString) return null;
        try {
            const options: Intl.DateTimeFormatOptions = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            };
            if (includeTime) {
                options.hour = '2-digit';
                options.minute = '2-digit';
            }
            return new Date(dateString).toLocaleDateString('en-US', options);
        } catch {
            return dateString;
        }
    };

    // Calculate resolution in megapixels
    const getMegapixels = (width?: number | null, height?: number | null) => {
        if (!width || !height) return null;
        const mp = (width * height) / 1000000;
        return mp.toFixed(1);
    };

    // Get file extension/type
    const getFileType = (filePath?: string | null) => {
        if (!filePath) return null;
        const ext = filePath.split('.').pop()?.toUpperCase();
        return ext || null;
    };

    // Parse auto_tags JSON string
    const parseAutoTags = (autoTags?: string | null): string[] => {
        if (!autoTags) return [];
        try {
            const parsed = JSON.parse(autoTags);
            if (Array.isArray(parsed)) {
                return parsed.map(t => typeof t === 'string' ? t : t.tag || t.name).filter(Boolean);
            }
            return [];
        } catch {
            // If it's a comma-separated string
            return autoTags.split(',').map(t => t.trim()).filter(Boolean);
        }
    };

    // Get aspect ratio
    const getAspectRatio = (width?: number | null, height?: number | null) => {
        if (!width || !height) return null;
        const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
        const divisor = gcd(width, height);
        const ratioW = width / divisor;
        const ratioH = height / divisor;

        // Simplify common ratios
        if (ratioW === 4 && ratioH === 3) return '4:3';
        if (ratioW === 3 && ratioH === 4) return '3:4';
        if (ratioW === 16 && ratioH === 9) return '16:9';
        if (ratioW === 9 && ratioH === 16) return '9:16';
        if (ratioW === 3 && ratioH === 2) return '3:2';
        if (ratioW === 2 && ratioH === 3) return '2:3';
        if (ratioW === 1 && ratioH === 1) return '1:1';

        // For unusual ratios, show decimal
        return (width / height).toFixed(2) + ':1';
    };

    const autoTags = parseAutoTags(imageDetails?.auto_tags);

    return (
        <div className="h-full w-full flex flex-col bg-[#252525] overflow-y-auto">
            <div className="p-4 space-y-4">

                {/* Album Section (only when viewing an album) */}
                {currentAlbum && (
                    <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase mb-3">
                            <Folder size={12} />
                            <span>Album</span>
                        </div>

                        {/* Album Cover */}
                        {currentAlbum.cover_path && (
                            <div className="w-full h-24 rounded-lg overflow-hidden mb-3">
                                <img
                                    src={assetUrl(currentAlbum.cover_path)}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        )}

                        {/* Album Name */}
                        <h3 className="text-lg font-semibold text-white mb-1">
                            {currentAlbum.name}
                        </h3>

                        {/* Album Description */}
                        {currentAlbum.description && (
                            <p className="text-sm text-gray-400 mb-3">
                                {currentAlbum.description}
                            </p>
                        )}

                        {/* Album Stats */}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{currentAlbum.photo_count ?? 0} photos</span>
                            <span>Created {new Date(currentAlbum.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                )}

                {/* Image Details Section */}
                {selectedImagePath && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase">
                            <Image size={12} />
                            <span>Image Details</span>
                        </div>

                        {/* File Info */}
                        <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                <FileText size={12} />
                                <span className="uppercase font-medium">File</span>
                            </div>
                            <div className="space-y-1.5 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Name</span>
                                    <span className="text-gray-300 truncate max-w-[160px]" title={imageDetails?.file_name || selectedImagePath.split('/').pop()}>
                                        {imageDetails?.file_name || selectedImagePath.split('/').pop()}
                                    </span>
                                </div>
                                {getFileType(selectedImagePath) && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Type</span>
                                        <span className="text-gray-300">{getFileType(selectedImagePath)}</span>
                                    </div>
                                )}
                                {formatFileSize(imageDetails?.file_size) && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Size</span>
                                        <span className="text-gray-300">{formatFileSize(imageDetails?.file_size)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Resolution Info */}
                        {(imageDetails?.width && imageDetails?.height) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Aperture size={12} />
                                    <span className="uppercase font-medium">Resolution</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Dimensions</span>
                                        <span className="text-gray-300">
                                            {imageDetails.width} × {imageDetails.height} px
                                        </span>
                                    </div>
                                    {getMegapixels(imageDetails.width, imageDetails.height) && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Megapixels</span>
                                            <span className="text-gray-300">
                                                {getMegapixels(imageDetails.width, imageDetails.height)} MP
                                            </span>
                                        </div>
                                    )}
                                    {getAspectRatio(imageDetails.width, imageDetails.height) && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Aspect Ratio</span>
                                            <span className="text-gray-300">
                                                {getAspectRatio(imageDetails.width, imageDetails.height)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Date Info */}
                        {(imageDetails?.date_taken || imageDetails?.date_imported) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Calendar size={12} />
                                    <span className="uppercase font-medium">Dates</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    {imageDetails?.date_taken && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Taken</span>
                                            <span className="text-gray-300">{formatDate(imageDetails.date_taken)}</span>
                                        </div>
                                    )}
                                    {imageDetails?.date_imported && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Imported</span>
                                            <span className="text-gray-300">{formatDate(imageDetails.date_imported, false)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Camera Info */}
                        {(imageDetails?.camera_make || imageDetails?.camera_model || imageDetails?.focal_length || imageDetails?.aperture) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Camera size={12} />
                                    <span className="uppercase font-medium">Camera & Lens</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    {(imageDetails.camera_make || imageDetails.camera_model) && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Model</span>
                                            <span className="text-gray-300 truncate max-w-[160px]">
                                                {[imageDetails.camera_make, imageDetails.camera_model].filter(Boolean).join(' ')}
                                            </span>
                                        </div>
                                    )}
                                    {imageDetails?.focal_length && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Focal Length</span>
                                            <span className="text-gray-300">{imageDetails.focal_length}mm</span>
                                        </div>
                                    )}
                                    {imageDetails?.aperture && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Aperture</span>
                                            <span className="text-gray-300">f/{imageDetails.aperture.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Exposure Settings */}
                        {(imageDetails?.shutter_speed || imageDetails?.iso || imageDetails?.exposure_program || imageDetails?.metering_mode) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Zap size={12} />
                                    <span className="uppercase font-medium">Exposure</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    {imageDetails?.shutter_speed && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Shutter Speed</span>
                                            <span className="text-gray-300">{imageDetails.shutter_speed}</span>
                                        </div>
                                    )}
                                    {imageDetails?.iso && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">ISO</span>
                                            <span className="text-gray-300">{imageDetails.iso}</span>
                                        </div>
                                    )}
                                    {imageDetails?.exposure_program && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Program</span>
                                            <span className="text-gray-300">{imageDetails.exposure_program}</span>
                                        </div>
                                    )}
                                    {imageDetails?.metering_mode && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Metering</span>
                                            <span className="text-gray-300">{imageDetails.metering_mode}</span>
                                        </div>
                                    )}
                                    {imageDetails?.flash && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Flash</span>
                                            <span className="text-gray-300">{imageDetails.flash}</span>
                                        </div>
                                    )}
                                    {imageDetails?.white_balance && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">White Balance</span>
                                            <span className="text-gray-300">{imageDetails.white_balance}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Color & Technical */}
                        {(imageDetails?.format || imageDetails?.color_space) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Palette size={12} />
                                    <span className="uppercase font-medium">Color</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    {imageDetails?.format && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Format</span>
                                            <span className="text-gray-300">{imageDetails.format.toUpperCase()}</span>
                                        </div>
                                    )}
                                    {imageDetails?.color_space && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Color Space</span>
                                            <span className="text-gray-300">{imageDetails.color_space}</span>
                                        </div>
                                    )}
                                    {imageDetails?.has_alpha !== null && imageDetails?.has_alpha !== undefined && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Alpha Channel</span>
                                            <span className="text-gray-300">{imageDetails.has_alpha ? 'Yes' : 'No'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Location Info */}
                        {(imageDetails?.gps_lat && imageDetails?.gps_lng) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <MapPin size={12} />
                                    <span className="uppercase font-medium">Location</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Coordinates</span>
                                        <span className="text-gray-300 text-xs">
                                            {imageDetails.gps_lat.toFixed(6)}, {imageDetails.gps_lng.toFixed(6)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Scene Type */}
                        {imageDetails?.scene_type && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Image size={12} />
                                    <span className="uppercase font-medium">Scene</span>
                                </div>
                                <span className="px-2 py-1 text-xs bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                                    {imageDetails.scene_type}
                                </span>
                            </div>
                        )}

                        {/* Auto Tags */}
                        {autoTags.length > 0 && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Tag size={12} />
                                    <span className="uppercase font-medium">AI Tags</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {autoTags.slice(0, 10).map((tag, idx) => (
                                        <span
                                            key={idx}
                                            className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-300 rounded border border-blue-500/30"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    {autoTags.length > 10 && (
                                        <span className="px-2 py-0.5 text-xs text-gray-500">
                                            +{autoTags.length - 10} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Technical Info */}
                        {(imageDetails?.file_hash || imageDetails?.phash || imageDetails?.analyzed_at) && (
                            <div className="bg-[#1a1a1a] rounded-lg border border-[#333333] p-3">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                                    <Hash size={12} />
                                    <span className="uppercase font-medium">Technical</span>
                                </div>
                                <div className="space-y-1.5 text-sm">
                                    {imageDetails?.analyzed_at && (
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Analyzed</span>
                                            <span className="text-gray-300 text-xs">{formatDate(imageDetails.analyzed_at, false)}</span>
                                        </div>
                                    )}
                                    {imageDetails?.file_hash && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-gray-500">Hash</span>
                                            <span className="text-gray-400 text-[10px] font-mono truncate max-w-[120px]" title={imageDetails.file_hash}>
                                                {imageDetails.file_hash.slice(0, 16)}...
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* No Selection State */}
                {!selectedImagePath && !currentAlbum && (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                        <Info size={32} className="mb-2 opacity-50" />
                        <p className="text-sm">Select an image to view details</p>
                    </div>
                )}
            </div>
        </div>
    );
}
