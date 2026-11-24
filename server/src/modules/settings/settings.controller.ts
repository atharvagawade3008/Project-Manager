import { Router, Request, Response, NextFunction } from 'express';
import { SettingsService } from './settings.service.js';

export const settingsRouter = Router();

settingsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await SettingsService.getAllSettings();
    res.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await SettingsService.updateSettings(req.body);
    res.json({
      success: true,
      data: settings,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
