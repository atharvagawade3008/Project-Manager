import { Router, Request, Response, NextFunction } from 'express';
import { OllamaService } from './ollama.service.js';

export const ollamaRouter = Router();

// GET /api/ollama/status
ollamaRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await OllamaService.checkStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/ollama/models
ollamaRouter.get('/models', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await OllamaService.listModels();
    res.json({
      success: true,
      data: models,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/ollama/settings
ollamaRouter.post('/settings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint, activeModel } = req.body;
    if (endpoint) {
      await OllamaService.setEndpoint(endpoint);
    }
    if (activeModel) {
      await OllamaService.setSelectedModel(activeModel);
    }
    const status = await OllamaService.checkStatus();
    res.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
