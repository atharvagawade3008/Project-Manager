import prisma from './db.js';

async function seed() {
  console.log('[Seed] Checking existing projects...');
  const count = await prisma.project.count();
  if (count > 0) {
    console.log(`[Seed] Database already has ${count} project(s). Skipping seed.`);
    return;
  }

  console.log('[Seed] Seeding initial developer sample projects...');

  // Project 1: Navi Mumbai 3D Open-World Engine
  const p1 = await prisma.project.create({
    data: {
      name: 'Navi Mumbai 3D Open-World Engine',
      description: 'A realistic 3D open-world browser experience based in Nerul and Seawoods with vehicle physics, roads, pedestrians, and interactive missions.',
      category: 'Game Development',
      objective: 'Build an optimized Three.js + Cannon-es browser engine rendering realistic Nerul/Seawoods sectors.',
      expectedDeliverables: 'Vehicle controller with suspension, procedural road network, GLTF building loader, pedestrian AI, and mission state machine.',
      techStack: JSON.stringify(['TypeScript', 'Three.js', 'Cannon-es', 'Vite', 'Zustand']),
      complexity: 'High',
      status: 'ACTIVE',
      healthStatus: 'GOOD',
      overallProgress: 49.0,
      verificationConfidence: 82.0,
      targetDeadline: new Date(Date.now() + 60 * 24 * 3600 * 1000), // 60 days
      lastScanAt: new Date(),
    },
  });

  // Phases for Project 1
  const ph1 = await prisma.projectPhase.create({
    data: {
      projectId: p1.id,
      name: 'Phase 1: Physics & Movement Core',
      description: 'Vehicle dynamics, tire friction, steering input, and camera following.',
      orderIndex: 0,
      status: 'IN_PROGRESS',
    },
  });

  const ph2 = await prisma.projectPhase.create({
    data: {
      projectId: p1.id,
      name: 'Phase 2: World Environment & Roads',
      description: 'Terrain rendering, Nerul/Seawoods tile grid, and road collision meshes.',
      orderIndex: 1,
      status: 'NOT_STARTED',
    },
  });

  // Tasks for Project 1
  const t1 = await prisma.task.create({
    data: {
      projectId: p1.id,
      phaseId: ph1.id,
      title: 'Implement vehicle raycast suspension',
      description: 'Configure spring damping and tire friction curves using Cannon-es RaycastVehicle.',
      status: 'COMPLETED',
      priority: 'HIGH',
      estimatedHours: 16,
      actualHours: 14,
      orderIndex: 0,
    },
  });

  const t2 = await prisma.task.create({
    data: {
      projectId: p1.id,
      phaseId: ph1.id,
      title: 'Vehicle collision response with roadside barriers',
      description: 'Prevent vehicle clipping through highway dividers and curbs.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      estimatedHours: 12,
      deadline: new Date(Date.now() + 4 * 24 * 3600 * 1000),
      orderIndex: 1,
    },
  });

  const t3 = await prisma.task.create({
    data: {
      projectId: p1.id,
      phaseId: ph2.id,
      title: 'Nerul station flyover 3D asset optimization',
      description: 'Reduce polycount of Seawoods Grand Central and Nerul flyover LOD meshes.',
      status: 'BLOCKED',
      priority: 'CRITICAL',
      estimatedHours: 20,
      deadline: new Date(Date.now() - 1 * 24 * 3600 * 1000), // Overdue
      orderIndex: 2,
    },
  });

  // Features with weighted completion (from prompt specification)
  // | Feature | Weight | Completion |
  // | Player movement | 20 | 100% |
  // | Vehicle physics | 25 | 60% |
  // | Map environment | 30 | 40% |
  // | Mission system | 15 | 0% |
  // | UI | 10 | 80% |
  // Weighted: (20*100 + 25*60 + 30*40 + 15*0 + 10*80) / 100 = (2000 + 1500 + 1200 + 0 + 800) / 100 = 5500 / 100 = 55%
  await prisma.feature.createMany({
    data: [
      {
        projectId: p1.id,
        name: 'Player Movement & Controls',
        description: 'First-person / third-person player traversal with sprint and jump physics.',
        category: 'Gameplay',
        weight: 20.0,
        estimatedProgress: 100.0,
        verificationConfidence: 95.0,
        status: 'VERIFIED',
      },
      {
        projectId: p1.id,
        name: 'Vehicle Physics & Dynamics',
        description: 'Raycast vehicle model, steering, acceleration, and suspension damping.',
        category: 'Physics',
        weight: 25.0,
        estimatedProgress: 60.0,
        verificationConfidence: 80.0,
        status: 'PARTIALLY_IMPLEMENTED',
        missingRequirements: 'Collision handling and suspension bottoming behavior not yet verified.',
      },
      {
        projectId: p1.id,
        name: 'Map Environment & Roads',
        description: 'Sector loading for Nerul and Seawoods, road mesh splines, and building collision.',
        category: 'World',
        weight: 30.0,
        estimatedProgress: 40.0,
        verificationConfidence: 75.0,
        status: 'PARTIALLY_IMPLEMENTED',
        missingRequirements: 'Road spline mesh generator incomplete.',
      },
      {
        projectId: p1.id,
        name: 'Mission Management System',
        description: 'Waypoint objectives, checkpoint triggers, time-trial logic, and mission state.',
        category: 'Missions',
        weight: 15.0,
        estimatedProgress: 0.0,
        verificationConfidence: 90.0,
        status: 'NOT_STARTED',
        missingRequirements: 'No source files or mission state machine found.',
      },
      {
        projectId: p1.id,
        name: 'HUD & Minimap UI',
        description: 'Speedometer, mini radar map, objective indicators, and pause menu.',
        category: 'Interface',
        weight: 10.0,
        estimatedProgress: 80.0,
        verificationConfidence: 85.0,
        status: 'IMPLEMENTED',
        missingRequirements: 'Settings audio sliders remain unhooked.',
      },
    ],
  });

  // AI Recommendations for Project 1
  await prisma.aIRecommendation.create({
    data: {
      projectId: p1.id,
      title: 'Implement vehicle collision response',
      explanation: 'VehicleController.ts handles throttle and steering, but raycast wheels ignore dynamic roadside barriers, causing fall-throughs.',
      recommendedAction: 'Attach convex hull colliders to barriers and register Cannon-es collision event listeners.',
      priority: 'HIGH',
      category: 'NEXT_STEP',
    },
  });

  await prisma.aIRecommendation.create({
    data: {
      projectId: p1.id,
      title: 'Unblock Nerul station flyover mesh LODs',
      explanation: 'GLTF model file size exceeds 85MB without Draco compression, creating substantial frame drops on initial sector render.',
      recommendedAction: 'Run gltf-transform to apply meshopt or Draco compression and generate LOD stages.',
      priority: 'CRITICAL',
      category: 'ARCHITECTURE',
    },
  });

  // Project Activity
  await prisma.projectActivity.create({
    data: {
      projectId: p1.id,
      type: 'PROJECT_CREATED',
      description: 'Project "Navi Mumbai 3D Open-World Engine" initialized.',
    },
  });

  await prisma.projectActivity.create({
    data: {
      projectId: p1.id,
      type: 'PLAN_UPDATED',
      description: 'Hierarchical development plan generated with 2 phases and 5 core features.',
    },
  });

  console.log('[Seed] Database seeded successfully.');
}

seed()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
