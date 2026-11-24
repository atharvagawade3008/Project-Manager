import { Router, Request, Response, NextFunction } from 'express';
import { AiService } from './ai.service.js';

export const aiRouter = Router();

// GET /api/ai/plan/:projectId — full phase/module/milestone/task hierarchy
aiRouter.get('/plan/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await AiService.getPlan(String(req.params.projectId));
    res.json({ success: true, data: project, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/plan/:projectId/generate — ask Ollama for a forward-looking plan
aiRouter.post('/plan/:projectId/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const replace = req.body?.replace !== false;
    const result = await AiService.generatePlan(String(req.params.projectId), { replace });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/ai/tasks/:taskId/status — move a task between plan states
aiRouter.patch('/tasks/:taskId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body || {};
    if (typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A task status is required.',
        timestamp: new Date().toISOString(),
      });
    }
    const task = await AiService.updateTaskStatus(String(req.params.taskId), status);
    res.json({ success: true, data: task, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/assistant/:projectId/history
aiRouter.get('/assistant/:projectId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await AiService.getAssistantHistory(String(req.params.projectId));
    res.json({ success: true, data: messages, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// GET /api/ai/hld/:projectId
aiRouter.get('/hld/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hld = await AiService.getHld(String(req.params.projectId));
    res.json({ success: true, data: hld, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/hld/:projectId/generate
aiRouter.post('/hld/:projectId/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await AiService.generateHld(String(req.params.projectId));
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

// POST /api/ai/assistant/:projectId/chat
aiRouter.post('/assistant/:projectId/chat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A message is required.',
        timestamp: new Date().toISOString(),
      });
    }
    const result = await AiService.chat(String(req.params.projectId), message.trim().slice(0, 4000));
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});
