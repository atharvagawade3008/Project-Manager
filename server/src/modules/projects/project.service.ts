import prisma from '../../db.js';
import { ProjectStats } from '../../types/index.js';

export interface CreateProjectDTO {
  name: string;
  description: string;
  category?: string;
  objective?: string;
  expectedDeliverables?: string;
  techStack?: string[];
  startDate?: string;
  targetDeadline?: string;
  complexity?: string;
  rootPath?: string;
  activeModel?: string;
}

export class ProjectService {
  public static async listProjects(query?: { search?: string; category?: string; status?: string }) {
    const where: any = {};

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search } },
        { description: { contains: query.search } },
      ];
    }

    if (query?.category && query.category !== 'ALL') {
      where.category = query.category;
    }

    if (query?.status && query.status !== 'ALL') {
      where.status = query.status;
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            tasks: true,
            features: true,
            scannedFiles: true,
          },
        },
        phases: {
          take: 3,
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    // Augment with completed task counts
    const augmented = await Promise.all(
      projects.map(async (p) => {
        const completedTasksCount = await prisma.task.count({
          where: { projectId: p.id, status: 'COMPLETED' },
        });
        const pendingTasksCount = p._count.tasks - completedTasksCount;
        let techStackParsed: string[] = [];
        try {
          techStackParsed = JSON.parse(p.techStack);
        } catch {
          techStackParsed = [];
        }

        return {
          ...p,
          techStack: techStackParsed,
          completedTasksCount,
          pendingTasksCount,
        };
      })
    );

    return augmented;
  }

  public static async getProjectById(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        phases: {
          orderBy: { orderIndex: 'asc' },
          include: {
            modules: {
              orderBy: { orderIndex: 'asc' },
              include: {
                milestones: true,
              },
            },
          },
        },
        modules: {
          orderBy: { orderIndex: 'asc' },
        },
        milestones: {
          orderBy: { targetDate: 'asc' },
        },
        tasks: {
          orderBy: { orderIndex: 'asc' },
          include: {
            subtasks: {
              orderBy: { orderIndex: 'asc' },
            },
            dependencies: {
              include: {
                dependsOnTask: true,
              },
            },
          },
        },
        features: {
          orderBy: { weight: 'desc' },
          include: {
            evidences: true,
          },
        },
        recommendations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        progressSnapshots: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 15,
        },
        analysisReports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!project) return null;

    let techStackParsed: string[] = [];
    try {
      techStackParsed = JSON.parse(project.techStack);
    } catch {
      techStackParsed = [];
    }

    const completedTasksCount = project.tasks.filter((t) => t.status === 'COMPLETED').length;
    const pendingTasksCount = project.tasks.length - completedTasksCount;

    return {
      ...project,
      techStack: techStackParsed,
      completedTasksCount,
      pendingTasksCount,
    };
  }

  public static async createProject(data: CreateProjectDTO) {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category || 'Software Development',
        objective: data.objective || '',
        expectedDeliverables: data.expectedDeliverables || '',
        techStack: JSON.stringify(data.techStack || []),
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        targetDeadline: data.targetDeadline ? new Date(data.targetDeadline) : null,
        complexity: data.complexity || 'Medium',
        rootPath: data.rootPath || null,
        activeModel: data.activeModel || null,
        healthStatus: 'GOOD',
        status: 'ACTIVE',
      },
    });

    // Record activity
    await prisma.projectActivity.create({
      data: {
        projectId: project.id,
        type: 'PROJECT_CREATED',
        description: `Project "${project.name}" was created.`,
      },
    });

    return project;
  }

  public static async updateProject(
    id: string,
    data: Partial<CreateProjectDTO> & { status?: string; healthStatus?: string; overallProgress?: number }
  ) {
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) throw new Error('Project not found');

    const updateData: any = { ...data };
    const statusChanged = typeof data.status === 'string' && data.status !== existing.status;

    // Completion is a user decision, so it owns the headline progress number:
    // marking complete pins 100% (later evidence scans cannot lower it), and
    // reopening restores the last evidence-based score.
    if (statusChanged) {
      if (data.status === 'COMPLETED') {
        updateData.overallProgress = 100;
        updateData.healthStatus = 'EXCELLENT';
      } else if (existing.status === 'COMPLETED') {
        const latestAssessment = await prisma.projectAssessment.findFirst({
          where: { projectId: id },
          orderBy: { createdAt: 'desc' },
        });
        const latestSnapshot = latestAssessment
          ? null
          : await prisma.progressSnapshot.findFirst({
              where: { projectId: id },
              orderBy: { createdAt: 'desc' },
            });
        updateData.overallProgress = latestAssessment?.productCompletion ?? latestSnapshot?.overallProgress ?? 0;
        updateData.healthStatus = 'GOOD';
      }
    }

    if (data.techStack) {
      updateData.techStack = JSON.stringify(data.techStack);
    }
    if (data.startDate) {
      updateData.startDate = new Date(data.startDate);
    }
    if (data.targetDeadline) {
      updateData.targetDeadline = new Date(data.targetDeadline);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    if (statusChanged) {
      const completed = data.status === 'COMPLETED';
      await prisma.projectActivity.create({
        data: {
          projectId: id,
          type: completed ? 'PROJECT_COMPLETED' : 'PROJECT_REOPENED',
          description: completed
            ? `Project "${updated.name}" was marked as completed.`
            : `Project "${updated.name}" was reopened.`,
        },
      });
    }

    return updated;
  }

  public static async deleteProject(id: string) {
    return await prisma.project.delete({
      where: { id },
    });
  }

  public static async getGlobalStats(): Promise<ProjectStats> {
    const totalProjects = await prisma.project.count();
    const activeProjects = await prisma.project.count({
      where: { status: 'ACTIVE' },
    });
    const completedProjects = await prisma.project.count({
      where: { status: 'COMPLETED' },
    });

    const totalPendingTasks = await prisma.task.count({
      where: {
        status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW'] },
      },
    });

    const now = new Date();
    const overdueTasks = await prisma.task.count({
      where: {
        status: { not: 'COMPLETED' },
        deadline: { lt: now },
      },
    });

    const projects = await prisma.project.findMany({
      select: { overallProgress: true, verificationConfidence: true },
    });

    const averageCompletion =
      projects.length > 0
        ? Math.round((projects.reduce((acc, p) => acc + p.overallProgress, 0) / projects.length) * 10) / 10
        : 0;

    const averageConfidence =
      projects.length > 0
        ? Math.round((projects.reduce((acc, p) => acc + p.verificationConfidence, 0) / projects.length) * 10) / 10
        : 0;

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalPendingTasks,
      overdueTasks,
      averageCompletion,
      averageConfidence,
    };
  }
}
