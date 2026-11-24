import React, { useState } from 'react';
import {
  FolderOpen,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Compass,
  FileSearch,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '../../api/client';
import { FolderExplorerModal } from './FolderExplorerModal';

interface FolderDropzoneProps {
  currentPath: string;
  onPathChange: (newPath: string) => void;
  onPathValidated?: (validatedPath: string) => void | Promise<void>;
  onScanNow?: () => void;
  scanning?: boolean;
}

export const FolderDropzone: React.FC<FolderDropzoneProps> = ({
  currentPath,
  onPathChange,
  onPathValidated,
  onScanNow,
  scanning = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pathInput, setPathInput] = useState(currentPath);
  const [validating, setValidating] = useState(false);
  const [nativePickerLoading, setNativePickerLoading] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    resolvedPath?: string;
    wasRedirected?: boolean;
    message?: string;
  } | null>(null);
  const [isExplorerModalOpen, setIsExplorerModalOpen] = useState(false);

  React.useEffect(() => {
    // Parent state also mirrors the draft while typing. Only validate when the
    // path changed externally, otherwise every keystroke would trigger a write.
    const cameFromExternalChange = currentPath.trim() !== pathInput.trim();
    setPathInput(currentPath);
    if (currentPath.trim() && cameFromExternalChange) {
      void validatePath(currentPath);
    }
  }, [currentPath]);

  const validatePath = async (pathToTest: string): Promise<boolean> => {
    if (!pathToTest.trim()) {
      setValidationResult(null);
      return false;
    }
    try {
      setValidating(true);
      const res = await api.validateDirectory(pathToTest.trim());
      if (res.valid && res.resolvedPath) {
        setPathInput(res.resolvedPath);
        setValidationResult({
          valid: true,
          resolvedPath: res.resolvedPath,
          wasRedirected: (res as any).wasRedirected,
          message: (res as any).wasRedirected
            ? `Auto-located folder at: ${res.resolvedPath}`
            : 'Valid directory on local filesystem',
        });
        // Only a resolved, validated path is safe to persist. In particular,
        // never write intermediate keystrokes to the project record.
        onPathChange(res.resolvedPath);
        await onPathValidated?.(res.resolvedPath);
        return true;
      }
      setValidationResult({
        valid: false,
        message: res.error || 'Directory does not exist or is inaccessible',
      });
      return false;
    } catch (err: any) {
      setValidationResult({ valid: false, message: err.message || 'Validation error' });
      return false;
    } finally {
      setValidating(false);
    }
  };

  const handleApplyPath = async (path: string) => {
    setPathInput(path);
    onPathChange(path);
    await validatePath(path);
  };

  const handleScanClick = async () => {
    if (scanning || validating) return;
    const valid = await validatePath(pathInput);
    if (valid) onScanNow?.();
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    // Check directory items
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
      if (entry && entry.isDirectory) {
        const folderName = entry.name;
        // Validate by folder name: our backend will auto-locate it!
        handleApplyPath(folderName);
        return;
      }
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const firstFile = files[0];
      const filePath = (firstFile as any).path;
      if (filePath) {
        const dir = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
        if (dir) {
          handleApplyPath(dir);
          return;
        }
      }
      if (firstFile.name) {
        handleApplyPath(firstFile.name);
      }
    }
  };

  // Native Windows Explorer Folder Dialog Launcher
  const handleNativePicker = async () => {
    try {
      setNativePickerLoading(true);
      const res = await api.openNativeFolderPicker();
      if (res.selectedPath && !res.cancelled) {
        handleApplyPath(res.selectedPath);
      }
    } catch (err: any) {
      console.error('Native folder picker failed:', err);
    } finally {
      setNativePickerLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Interactive Drag & Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed p-6 transition-all duration-200 text-center flex flex-col items-center justify-center ${
          isDragging
            ? 'border-cyan-400 bg-cyan-950/30 scale-[1.01] shadow-xl shadow-cyan-950/40'
            : 'border-slate-800 bg-[#131316]/80 hover:border-slate-700/80'
        }`}
      >
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
            isDragging
              ? 'bg-cyan-500/20 text-cyan-300'
              : 'bg-slate-900 border border-slate-800 text-slate-400'
          }`}
        >
          {isDragging ? <UploadCloud className="w-6 h-6 animate-bounce" /> : <FolderOpen className="w-6 h-6 text-cyan-400" />}
        </div>

        <h4 className="text-sm font-semibold text-slate-100">
          {isDragging ? 'Drop Folder Here to Link' : 'Drag & Drop Project Folder Here'}
        </h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          Drop any folder from Windows Explorer, browse with native file dialog, or enter its path below.
        </p>

        {/* Action Buttons inside Dropzone */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          <Button
            type="button"
            variant="glow"
            size="sm"
            onClick={handleNativePicker}
            loading={nativePickerLoading}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Browse File Explorer</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsExplorerModalOpen(true)}
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>In-App Navigator</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handleApplyPath('C:\\Users\\nodefour\\Desktop\\Code\\Aeroleaf')}
            className="text-[11px] font-mono text-cyan-300 border-cyan-800/40"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Aeroleaf (Desktop\Code)</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              handleApplyPath('c:\\Users\\nodefour\\Desktop\\Project Manager\\sample-project')
            }
            className="text-[11px] font-mono"
          >
            Sample Project
          </Button>
        </div>
      </div>

      {/* Path Input & Validation Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 relative flex items-center bg-[#131316] border border-slate-800 focus-within:border-cyan-500 rounded-xl px-3.5 py-2 transition-colors">
          <HardDrive className="w-4 h-4 text-cyan-400 shrink-0 mr-2" />
          <input
            type="text"
            value={pathInput}
            onChange={(e) => {
              // Keep the draft local. Persisting partial paths creates races that
              // leave the dashboard showing an old or truncated root path.
              setPathInput(e.target.value);
              onPathChange(e.target.value);
              setValidationResult(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleApplyPath(pathInput);
              }
            }}
            onBlur={() => {
              if (pathInput.trim() && pathInput.trim() !== currentPath) {
                void validatePath(pathInput);
              }
            }}
            placeholder="e.g. Aeroleaf or C:\Users\nodefour\Desktop\Code\Aeroleaf"
            className="w-full bg-transparent text-xs font-mono text-slate-100 placeholder-slate-600 focus:outline-none"
          />
          {validating && (
            <span className="text-[10px] font-mono text-cyan-400 animate-pulse shrink-0">
              Locating...
            </span>
          )}
        </div>

        {onScanNow && (
          <Button
            type="button"
            variant="glow"
            size="sm"
            onClick={handleScanClick}
            loading={validating || scanning}
            disabled={!pathInput.trim() || validating || scanning}
            className="shrink-0"
          >
            <FileSearch className="w-3.5 h-3.5" />
            <span>{scanning ? 'Analyzing Codebase...' : 'Scan & Understand'}</span>
          </Button>
        )}
      </div>

      {/* Validation Message */}
      {validationResult && (
        <div
          className={`text-[11px] font-mono flex items-center gap-1.5 px-1 ${
            validationResult.valid ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {validationResult.valid ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span>
            {validationResult.valid
              ? `${validationResult.message} (${validationResult.resolvedPath})`
              : validationResult.message}
          </span>
        </div>
      )}

      {/* In-App Directory Explorer Modal */}
      <FolderExplorerModal
        isOpen={isExplorerModalOpen}
        onClose={() => setIsExplorerModalOpen(false)}
        initialPath={pathInput || currentPath || 'C:\\Users\\nodefour\\Desktop\\Code'}
        onSelectFolder={(selected) => handleApplyPath(selected)}
      />
    </div>
  );
};
