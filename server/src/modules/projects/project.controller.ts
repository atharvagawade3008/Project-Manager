import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from './project.service.js';
import { FolderProjectAnalysisService } from './folder-analysis.service.js';

export const projectRouter = Router();

// GET /api/projects
projectRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, category, status } = req.query;
    const projects = await ProjectService.listProjects({
      search: search as string,
      category: category as string,
      status: status as string,
    });
    res.json({
      success: true,
      data: projects,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/analyze-folder
// Read a local repository and suggest project metadata for the creation form.
projectRouter.post('/analyze-folder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path, useAI } = req.body || {};
    if (typeof path !== 'string' || !path.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A project folder path is required.',
        timestamp: new Date().toISOString(),
      });
    }

    const analysis = await FolderProjectAnalysisService.analyze(path, {
      useAI: useAI !== false,
    });
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error?.message || 'Could not analyze the selected project folder.',
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/projects/:id
projectRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const project = await ProjectService.getProjectById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        timestamp: new Date().toISOString(),
      });
    }
    res.json({
      success: true,
      data: project,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects
projectRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({
        success: false,
        error: 'Project name and description are required',
        timestamp: new Date().toISOString(),
      });
    }

    const project = await ProjectService.createProject(req.body);
    res.status(201).json({
      success: true,
      data: project,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:id
projectRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    const project = await ProjectService.updateProject(id, req.body);
    res.json({
      success: true,
      data: project,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:id
projectRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    await ProjectService.deleteProject(id);
    res.json({
      success: true,
      message: 'Project deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
