import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Folder, ChevronRight, CornerLeftUp, Check, HardDrive, Compass } from 'lucide-react';
import { api } from '../../api/client';

interface FolderExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (folderPath: string) => void;
  initialPath?: string;
}

export const FolderExplorerModal: React.FC<FolderExplorerModalProps> = ({
  isOpen,
  onClose,
  onSelectFolder,
  initialPath,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([]);
  const [shortcuts, setShortcuts] = useState<Array<{ name: string; path: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (pathToGo?: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.browseDirectories(pathToGo);
      setCurrentPath(res.currentPath);
      setParentPath(res.parentPath);
      setFolders(res.folders);
      if (res.shortcuts) {
        setShortcuts(res.shortcuts);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to list directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDirectory(initialPath);
    }
  }, [isOpen, initialPath]);

  const handleSelect = () => {
    onSelectFolder(currentPath);
    onClose();
  };

  // Split path for breadcrumb navigation
  const pathParts = currentPath.split(/[\\/]/).filter(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="File Explorer - Select Project Directory"
      description="Navigate your local drive or select a shortcut to connect your codebase."
      maxWidth="xl"
    >
      <div className="space-y-4">
        {/* Quick Shortcuts */}
        {shortcuts.length > 0 && (
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              Quick Shortcuts
            </span>
            <div className="flex flex-wrap gap-1.5">
              {shortcuts.map((sc) => (
                <button
                  key={sc.path}
                  type="button"
                  onClick={() => loadDirectory(sc.path)}
                  className="px-2.5 py-1 text-xs font-mono rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-slate-700 transition-colors"
                >
                  {sc.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Path Bar & Breadcrumbs */}
        <div className="p-2.5 rounded-xl bg-[#131316] border border-slate-800 text-xs font-mono flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-300 truncate">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">{currentPath}</span>
          </div>

          {parentPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadDirectory(parentPath)}
              disabled={loading}
              className="text-[11px] py-1 px-2 shrink-0"
            >
              <CornerLeftUp className="w-3 h-3" />
              <span>Up</span>
            </Button>
          )}
        </div>

        {error && (
          <div className="text-xs text-rose-400 p-2.5 rounded bg-rose-950/40 border border-rose-900">
            {error}
          </div>
        )}

        {/* Directory Items List */}
        <div className="h-64 overflow-y-auto rounded-xl border border-slate-800/80 bg-[#131316]/60 p-2 divide-y divide-slate-800/50">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              Loading directories...
            </div>
          ) : folders.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              No subdirectories found in this folder.
            </div>
          ) : (
            folders.map((folder) => (
              <button
                key={folder}
                type="button"
                onClick={() => {
                  const separator = currentPath.includes('/') ? '/' : '\\';
                  const nextPath = currentPath.endsWith(separator)
                    ? `${currentPath}${folder}`
                    : `${currentPath}${separator}${folder}`;
                  loadDirectory(nextPath);
                }}
                className="w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-800/60 rounded-lg group transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  <Folder className="w-4 h-4 text-cyan-400/80 group-hover:text-cyan-300 shrink-0" />
                  <span className="font-mono text-slate-300 group-hover:text-white truncate">
                    {folder}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
              </button>
            ))
          )}
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button type="button" variant="glow" size="sm" onClick={handleSelect}>
            <Check className="w-3.5 h-3.5" />
            <span>Select This Folder</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
