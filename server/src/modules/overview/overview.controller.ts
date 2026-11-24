import { Router, Request, Response, NextFunction } from 'express';
import { ProjectService } from '../projects/project.service.js';
import prisma from '../../db.js';

export const overviewRouter = Router();

// GET /api/overview/stats
overviewRouter.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await ProjectService.getGlobalStats();

    // Upcoming deadlines across projects
    const now = new Date();
    const upcomingDeadlines = await prisma.task.findMany({
      where: {
        status: { not: 'COMPLETED' },
        deadline: { gte: now },
      },
      orderBy: { deadline: 'asc' },
      take: 5,
      include: {
        project: {
          select: { id: true, name: true, category: true },
        },
      },
    });

    // Tasks requiring attention (BLOCKED, CRITICAL, or overdue)
    const attentionTasks = await prisma.task.findMany({
      where: {
        OR: [
          { status: 'BLOCKED' },
          { priority: 'CRITICAL', status: { not: 'COMPLETED' } },
          { deadline: { lt: now }, status: { not: 'COMPLETED' } },
        ],
      },
      orderBy: { deadline: 'asc' },
      take: 6,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Recent project activities
    const recentActivities = await prisma.projectActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // Latest AI recommendations
    const latestRecommendations = await prisma.aIRecommendation.findMany({
      where: { isConvertedToTask: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({
      success: true,
      data: {
        stats,
        upcomingDeadlines,
        attentionTasks,
        recentActivities,
        latestRecommendations,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});
