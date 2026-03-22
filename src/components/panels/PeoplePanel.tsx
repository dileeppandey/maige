/**
 * People Panel Component (Phase 3)
 * Displays detected people, unknown faces, and allows naming/organizing
 */

import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, Loader2, RefreshCw, EyeOff, Eye, CheckSquare, X, Sparkles, ChevronRight } from 'lucide-react';
import type { PersonRecord, FaceRecord, FaceCluster, FaceStats } from '../../../shared/types';
import { FaceThumbnail } from '../FaceThumbnail';
import { useLibraryStore } from '../../store/useLibraryStore';
import { EmptyState, Spinner, Button } from '../../design-system';

interface PeoplePanelProps {
    onSelectPerson?: (personId: number) => void;
    selectedPersonId?: number | null;
}

export function PeoplePanel({ onSelectPerson, selectedPersonId }: PeoplePanelProps) {
    const { showCluster } = useLibraryStore();
    const [people, setPeople] = useState<PersonRecord[]>([]);
    const [unidentifiedFaces, setUnidentifiedFaces] = useState<FaceRecord[]>([]);
    const [clusters, setClusters] = useState<FaceCluster[]>([]);
    const [stats, setStats] = useState<FaceStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isClustering, setIsClustering] = useState(false);
    const [clusterProgress, _setClusterProgress] = useState<{ current: number; total: number } | null>(null);
    const [namingFaceId, setNamingFaceId] = useState<number | null>(null);
    const [newPersonName, setNewPersonName] = useState('');

    // Cluster pagination
    const [visibleClusterCount, setVisibleClusterCount] = useState(10);

    // Hidden people state
    const [showHidden, setShowHidden] = useState(false);
    const [hiddenPeople, setHiddenPeople] = useState<PersonRecord[]>([]);

    // Multi-select state
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedFaces, setSelectedFaces] = useState<Set<number>>(new Set());
    const [showNameInput, setShowNameInput] = useState(false);

    // Load people and faces data
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [peopleData, facesData, statsData] = await Promise.all([
                window.api.getAllPeople(),
                window.api.getUnidentifiedFaces(),
                window.api.getFaceStats(),
            ]);
            setPeople(peopleData);
            setUnidentifiedFaces(facesData);
            setStats(statsData);

            // Load hidden people if toggle is on
            if (showHidden) {
                const hiddenData = await window.api.getHiddenPeople();
                setHiddenPeople(hiddenData);
            }
        } catch (error) {
            console.error('Failed to load people data:', error);
        } finally {
            setIsLoading(false);
        }
    }, [showHidden]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Cluster unidentified faces
    const handleCluster = async () => {
        setIsClustering(true);
        try {
            const clusterData = await window.api.clusterFaces();
            setClusters(clusterData);
        } catch (error) {
            console.error('Failed to cluster faces:', error);
        } finally {
            setIsClustering(false);
        }
    };

    // Create a new person from a face
    const handleCreatePerson = async (faceId: number) => {
        if (!newPersonName.trim()) return;

        try {
            await window.api.createPersonFromFace(faceId, newPersonName.trim());
            setNewPersonName('');
            setNamingFaceId(null);
            setClusters([]); // Clear clusters after naming
            await loadData();
        } catch (error) {
            console.error('Failed to create person:', error);
        }
    };

    // Create a new person from a cluster (assigns ALL faces to one person)
    const handleCreatePersonFromCluster = async (faceIds: number[]) => {
        if (!newPersonName.trim()) return;

        try {
            await window.api.createPersonFromCluster(faceIds, newPersonName.trim());
            setNewPersonName('');
            setNamingFaceId(null);
            setClusters([]); // Clear clusters after naming
            await loadData();
        } catch (error) {
            console.error('Failed to create person from cluster:', error);
        }
    };

    // Toggle face selection
    const toggleFaceSelection = (faceId: number, selected: boolean) => {
        setSelectedFaces(prev => {
            const newSet = new Set(prev);
            if (selected) {
                newSet.add(faceId);
            } else {
                newSet.delete(faceId);
            }
            return newSet;
        });
    };

    // Clear selection
    const clearSelection = () => {
        setSelectedFaces(new Set());
        setSelectionMode(false);
        setShowNameInput(false);
        setNewPersonName('');
    };

    // Create person from selected faces
    const handleNameSelected = async () => {
        if (!newPersonName.trim() || selectedFaces.size === 0) return;

        try {
            await window.api.createPersonFromCluster(
                Array.from(selectedFaces),
                newPersonName.trim()
            );
            clearSelection();
            setClusters([]);
            await loadData();
        } catch (error) {
            console.error('Failed to name selected faces:', error);
        }
    };

    // Select all faces in a cluster
    const selectAllInCluster = (faceIds: number[]) => {
        setSelectedFaces(prev => {
            const newSet = new Set(prev);
            faceIds.forEach(id => newSet.add(id));
            return newSet;
        });
    };

    // Hide a person
    const handleHidePerson = async (personId: number, hidden: boolean) => {
        try {
            await window.api.setPersonHidden(personId, hidden);
            await loadData();
        } catch (error) {
            console.error('Failed to hide person:', error);
        }
    };

    // Filtered people suggestions based on input
    const filteredSuggestions = newPersonName.trim().length > 0
        ? people.filter(p =>
            p.name.toLowerCase().includes(newPersonName.toLowerCase().trim())
        ).slice(0, 5)
        : [];

    // Select an existing person for the selected faces
    const selectExistingPerson = async (personId: number) => {
        if (selectedFaces.size > 0) {
            // Assign all selected faces to this person
            try {
                for (const faceId of selectedFaces) {
                    await window.api.assignFaceToPerson(faceId, personId);
                }
                clearSelection();
                setClusters([]);
                await loadData();
            } catch (error) {
                console.error('Failed to assign faces to person:', error);
            }
        } else if (namingFaceId) {
            // Assign single cluster to this person
            const cluster = clusters.find(c => c.faceIds.includes(namingFaceId));
            if (cluster) {
                try {
                    for (const faceId of cluster.faceIds) {
                        await window.api.assignFaceToPerson(faceId, personId);
                    }
                    setNamingFaceId(null);
                    setNewPersonName('');
                    setClusters([]);
                    await loadData();
                } catch (error) {
                    console.error('Failed to assign cluster to person:', error);
                }
            }
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full bg-surface-panel">
                <Spinner fullHeight />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-surface-panel text-text-primary relative">
            {/* Header */}
            <div className="p-3 border-b border-border-base">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.dispatchEvent(new CustomEvent('showLibrary'))}
                            title="Back to Library"
                        >
                            ←
                        </Button>
                        <Users className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold text-sm uppercase tracking-wide">People</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowHidden(!showHidden)}
                            className={`p-1 rounded ${showHidden ? 'bg-gray-200 dark:bg-gray-700 text-purple-400' : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'}`}
                            title={showHidden ? 'Hide hidden people' : 'Show hidden people'}
                        >
                            {showHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={loadData}
                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="mt-2 text-xs text-text-secondary grid grid-cols-2 gap-1">
                        <span>{stats.totalPeople} people</span>
                        <span>{stats.totalFaces} faces</span>
                        <span>{stats.identifiedFaces} identified</span>
                        <span>{stats.unidentifiedFaces} unknown</span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Named People */}
                {people.length > 0 && (
                    <div className="p-3 border-b border-border-base">
                        <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">
                            Named People
                        </h3>
                        <div className="space-y-1">
                            {people.map((person) => (
                                <div
                                    key={person.id}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer group ${selectedPersonId === person.id
                                        ? 'bg-accent'
                                        : 'hover:bg-surface-hover'
                                        }`}
                                    onClick={() => onSelectPerson?.(person.id)}
                                >
                                    {/* Avatar placeholder */}
                                    <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center text-sm font-medium text-text-primary">
                                        {person.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm">{person.name}</div>
                                        <div className="text-xs text-text-secondary">
                                            {person.face_count} photos
                                        </div>
                                    </div>
                                    {/* Hide button */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleHidePerson(person.id, true);
                                        }}
                                        title="Hide person"
                                    >
                                        <EyeOff className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Hidden People */}
                {showHidden && hiddenPeople.length > 0 && (
                    <div className="p-3 border-b border-border-base bg-surface-raised">
                        <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2 flex items-center gap-1">
                            <EyeOff className="w-3 h-3" />
                            Hidden People ({hiddenPeople.length})
                        </h3>
                        <div className="space-y-1">
                            {hiddenPeople.map((person) => (
                                <div
                                    key={person.id}
                                    className="flex items-center gap-2 p-2 rounded hover:bg-surface-hover opacity-60 group"
                                >
                                    {/* Avatar placeholder */}
                                    <div className="w-8 h-8 rounded-full bg-surface-card flex items-center justify-center text-sm font-medium text-text-muted">
                                        {person.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-sm text-text-secondary">{person.name}</div>
                                        <div className="text-xs text-text-muted">
                                            {person.face_count} photos
                                        </div>
                                    </div>
                                    {/* Unhide button */}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="opacity-0 group-hover:opacity-100 text-accent"
                                        onClick={() => handleHidePerson(person.id, false)}
                                        title="Unhide person"
                                    >
                                        <Eye className="w-3 h-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Unknown Faces */}
                {unidentifiedFaces.length > 0 && (
                    <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-semibold text-text-secondary uppercase">
                                Unknown Faces ({unidentifiedFaces.length})
                            </h3>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="link"
                                    size="xs"
                                    onClick={handleCluster}
                                    disabled={isClustering}
                                    leftIcon={isClustering ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                >
                                    Group similar
                                </Button>
                                {clusters.length > 0 && (
                                    <Button
                                        size="sm"
                                        variant={selectionMode ? 'primary' : 'secondary'}
                                        onClick={() => {
                                            setSelectionMode(!selectionMode);
                                            if (selectionMode) clearSelection();
                                        }}
                                        leftIcon={<CheckSquare className="w-3 h-3" />}
                                    >
                                        {selectionMode ? 'Cancel' : 'Select'}
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Display clusters or individual faces */}
                        {clusters.length > 0 ? (
                            <div className="space-y-3">
                                {/* Clustering progress */}
                                {isClustering && clusterProgress && (
                                    <div className="bg-surface-raised rounded p-2">
                                        <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                                            <span>Clustering faces...</span>
                                            <span>{clusterProgress.current}/{clusterProgress.total}</span>
                                        </div>
                                        <div className="h-1 bg-surface-card rounded overflow-hidden">
                                            <div
                                                className="h-full bg-accent transition-all"
                                                style={{ width: `${(clusterProgress.current / clusterProgress.total) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {clusters.slice(0, visibleClusterCount).map((cluster, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-surface-raised rounded p-2 hover:bg-surface-card cursor-pointer transition-colors"
                                        onClick={() => {
                                            if (!selectionMode) {
                                                showCluster(cluster);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                                            <span className="flex items-center gap-1">
                                                Cluster {idx + 1} ({cluster.faceIds.length} faces)
                                                <ChevronRight className="w-3 h-3" />
                                            </span>
                                            {selectionMode && (
                                                <Button
                                                    variant="link"
                                                    size="xs"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectAllInCluster(cluster.faceIds);
                                                    }}
                                                >
                                                    Select all
                                                </Button>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {cluster.faceIds.slice(0, 6).map((faceId) => (
                                                <FaceThumbnail
                                                    key={faceId}
                                                    faceId={faceId}
                                                    size={40}
                                                    selectable={selectionMode}
                                                    selected={selectedFaces.has(faceId)}
                                                    onSelectionChange={(sel) => toggleFaceSelection(faceId, sel)}
                                                    onClick={() => {
                                                        if (!selectionMode) setNamingFaceId(faceId);
                                                    }}
                                                />
                                            ))}
                                            {cluster.faceIds.length > 6 && (
                                                <div className="w-10 h-10 rounded bg-surface-card flex items-center justify-center text-xs text-text-primary">
                                                    +{cluster.faceIds.length - 6}
                                                </div>
                                            )}
                                        </div>
                                        {/* Name this cluster */}
                                        {namingFaceId && cluster.faceIds.includes(namingFaceId) && (
                                            <div className="mt-2 relative" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1">
                                                    <input
                                                        type="text"
                                                        value={newPersonName}
                                                        onChange={(e) => setNewPersonName(e.target.value)}
                                                        placeholder="Name this person..."
                                                        className="flex-1 px-2 py-1 text-sm bg-surface-input border border-border-base rounded text-text-primary"
                                                        autoFocus
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                handleCreatePersonFromCluster(cluster.faceIds);
                                                            } else if (e.key === 'Escape') {
                                                                setNamingFaceId(null);
                                                                setNewPersonName('');
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={() => handleCreatePersonFromCluster(cluster.faceIds)}
                                                        title="Create new person"
                                                    >
                                                        <UserPlus className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                                {/* Suggestions dropdown */}
                                                {filteredSuggestions.length > 0 && (
                                                    <div className="absolute z-10 top-full left-0 right-10 mt-1 bg-surface-card border border-border-base rounded shadow-lg max-h-40 overflow-y-auto">
                                                        <div className="px-2 py-1 text-xs text-text-secondary border-b border-border-base">
                                                            Existing people:
                                                        </div>
                                                        {filteredSuggestions.map(person => (
                                                            <button
                                                                key={person.id}
                                                                onClick={() => selectExistingPerson(person.id)}
                                                                className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-hover flex items-center gap-2 text-text-primary"
                                                            >
                                                                <div className="w-5 h-5 rounded-full bg-surface-raised flex items-center justify-center text-xs text-text-primary">
                                                                    {person.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span>{person.name}</span>
                                                                <span className="ml-auto text-xs text-text-secondary">
                                                                    {person.face_count} photo{person.face_count !== 1 ? 's' : ''}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {/* Load more clusters button */}
                                {clusters.length > visibleClusterCount && (
                                    <button
                                        onClick={() => setVisibleClusterCount(prev => prev + 10)}
                                        className="w-full py-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-200 dark:hover:bg-gray-700/50 rounded"
                                    >
                                        Show more clusters ({clusters.length - visibleClusterCount} remaining)
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-2">
                                {unidentifiedFaces.slice(0, 20).map((face) => (
                                    <FaceThumbnail
                                        key={face.id}
                                        faceId={face.id}
                                        size={60}
                                        onClick={() => setNamingFaceId(face.id)}
                                        selected={namingFaceId === face.id}
                                    />
                                ))}
                                {unidentifiedFaces.length > 20 && (
                                    <div className="aspect-square rounded bg-surface-card flex items-center justify-center text-xs text-text-secondary">
                                        +{unidentifiedFaces.length - 20}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Naming dialog for individual face */}
                        {namingFaceId && !clusters.some(c => c.faceIds.includes(namingFaceId)) && (
                            <div className="mt-2 flex gap-1">
                                <input
                                    type="text"
                                    value={newPersonName}
                                    onChange={(e) => setNewPersonName(e.target.value)}
                                    placeholder="Name this person..."
                                    className="flex-1 px-2 py-1 text-sm bg-surface-input border border-border-base rounded text-text-primary"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleCreatePerson(namingFaceId);
                                        } else if (e.key === 'Escape') {
                                            setNamingFaceId(null);
                                            setNewPersonName('');
                                        }
                                    }}
                                />
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleCreatePerson(namingFaceId)}
                                >
                                    <UserPlus className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}

                {/* Empty state */}
                {people.length === 0 && unidentifiedFaces.length === 0 && (
                    <EmptyState
                        icon={<Users size={36} />}
                        title="No faces detected yet"
                        description="Import photos to detect faces"
                    />
                )}
            </div>

            {/* Floating selection panel */}
            {selectedFaces.size > 0 && (
                <div className="absolute bottom-0 left-0 right-0 bg-surface-card border-t border-border-base p-3 shadow-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-text-secondary">
                            {selectedFaces.size} face{selectedFaces.size > 1 ? 's' : ''} selected
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelection}
                            className="ml-auto"
                            title="Clear selection"
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                    {showNameInput ? (
                        <div className="relative mt-2">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newPersonName}
                                    onChange={(e) => setNewPersonName(e.target.value)}
                                    placeholder="Enter name..."
                                    className="flex-1 px-3 py-2 text-sm bg-surface-input border border-border-base rounded focus:border-accent focus:outline-none text-text-primary"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleNameSelected();
                                        if (e.key === 'Escape') setShowNameInput(false);
                                    }}
                                />
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleNameSelected}
                                    disabled={!newPersonName.trim()}
                                >
                                    Save
                                </Button>
                            </div>
                            {/* Suggestions dropdown */}
                            {filteredSuggestions.length > 0 && (
                                <div className="absolute z-10 bottom-full left-0 right-16 mb-1 bg-surface-card border border-border-base rounded shadow-lg max-h-40 overflow-y-auto">
                                    <div className="px-2 py-1 text-xs text-text-secondary border-b border-border-base">
                                        Existing people:
                                    </div>
                                    {filteredSuggestions.map(person => (
                                        <button
                                            key={person.id}
                                            onClick={() => selectExistingPerson(person.id)}
                                            className="w-full text-left px-2 py-1.5 text-sm hover:bg-surface-hover flex items-center gap-2 text-text-primary"
                                        >
                                            <div className="w-5 h-5 rounded-full bg-surface-raised flex items-center justify-center text-xs text-text-primary">
                                                {person.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span>{person.name}</span>
                                            <span className="ml-auto text-xs text-text-secondary">
                                                {person.face_count} photo{person.face_count !== 1 ? 's' : ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setShowNameInput(true)}
                            className="w-full mt-2"
                            leftIcon={<UserPlus className="w-4 h-4" />}
                        >
                            Name Selected Faces
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
