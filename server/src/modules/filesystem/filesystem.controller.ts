import { Router, Request, Response, NextFunction } from 'express';
import { FilesystemService } from './filesystem.service.js';
import { openNativeFolderPicker } from './nativePicker.js';
import prisma from '../../db.js';
import os from 'os';
import path from 'path';

export const filesystemRouter = Router();

// POST /api/filesystem/native-picker
filesystemRouter.post('/native-picker', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const selectedPath = await openNativeFolderPicker();
    res.json({
      success: true,
      data: {
        selectedPath,
        cancelled: !selectedPath,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/filesystem/validate
filesystemRouter.post('/validate', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: dirPath } = req.body;
    const result = FilesystemService.validateDirectory(dirPath);
    res.json({
      success: result.valid,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/filesystem/browse
filesystemRouter.get('/browse', (req: Request, res: Response, next: NextFunction) => {
  try {
    const basePath = req.query.path as string | undefined;
    const browseData = FilesystemService.browseDirectories(basePath);

    // Common Windows shortcuts
    const homeDir = os.homedir();
    const shortcuts = [
      { name: 'Desktop', path: path.join(homeDir, 'Desktop') },
      { name: 'Documents', path: path.join(homeDir, 'Documents') },
      { name: 'Downloads', path: path.join(homeDir, 'Downloads') },
      { name: 'Home', path: homeDir },
      { name: 'Project Manager', path: process.cwd() },
      { name: 'Sample Codebase', path: path.join(process.cwd(), 'sample-project') },
    ].filter((s) => FilesystemService.validateDirectory(s.path).valid);

    res.json({
      success: true,
      data: {
        ...browseData,
        shortcuts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/filesystem/files/:projectId
filesystemRouter.get('/files/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = String(req.params.projectId);
    const files = await prisma.scannedFile.findMany({
      where: { projectId },
      orderBy: { relativePath: 'asc' },
    });
    res.json({
      success: true,
      data: files,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
