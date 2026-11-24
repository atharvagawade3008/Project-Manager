import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler.js';
import { projectRouter } from './modules/projects/project.controller.js';
import { overviewRouter } from './modules/overview/overview.controller.js';
import { ollamaRouter } from './modules/ollama/ollama.controller.js';
import { settingsRouter } from './modules/settings/settings.controller.js';
import { filesystemRouter } from './modules/filesystem/filesystem.controller.js';
import { progressRouter } from './modules/progress/progress.controller.js';
import { aiRouter } from './modules/ai/ai.controller.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Project OS API Server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Modules
  app.use('/api/projects', projectRouter);
  app.use('/api/overview', overviewRouter);
  app.use('/api/ollama', ollamaRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/filesystem', filesystemRouter);
  app.use('/api/progress', progressRouter);
  app.use('/api/ai', aiRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}
