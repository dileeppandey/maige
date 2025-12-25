export type FileInfo = {
    name: string;
    path: string;
    isDirectory: boolean;
    type: 'image' | 'video' | 'other'; // Simplified for now
};

export type ScanResult = {
    files: FileInfo[];
    folderPath: string;
};
