import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { HttpError } from "../middleware/error";

const router = Router();

router.get("/catalogue", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        tasks: {
          orderBy: { name: "asc" },
          select: { id: true, slug: true, name: true, description: true },
        },
      },
    });
    res.json({
      categories: categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        tasks: c.tasks,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

router.get("/selections", async (req, res, next) => {
  try {
    const rows = await prisma.userTask.findMany({
      where: { userId: req.userId! },
      include: {
        task: {
          include: { category: { select: { name: true, slug: true } } },
        },
      },
    });
    res.json({
      tasks: rows.map((r) => ({
        id: r.task.id,
        slug: r.task.slug,
        name: r.task.name,
        description: r.task.description,
        category: r.task.category.name,
        categorySlug: r.task.category.slug,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const SelectBody = z.object({
  taskIds: z.array(z.string().min(1)).min(1, "Pick at least one task.").max(100),
});

router.put("/selections", async (req, res, next) => {
  try {
    const { taskIds } = SelectBody.parse(req.body);
    const unique = Array.from(new Set(taskIds));
    const existing = await prisma.task.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (existing.length !== unique.length) {
      throw new HttpError(400, "unknown_tasks", "One or more selected tasks don't exist.");
    }
    await prisma.$transaction([
      prisma.userTask.deleteMany({ where: { userId: req.userId! } }),
      prisma.userTask.createMany({
        data: unique.map((taskId) => ({ userId: req.userId!, taskId })),
      }),
    ]);
    const rows = await prisma.userTask.findMany({
      where: { userId: req.userId! },
      include: { task: { include: { category: true } } },
    });
    res.json({
      tasks: rows.map((r) => ({
        id: r.task.id,
        slug: r.task.slug,
        name: r.task.name,
        description: r.task.description,
        category: r.task.category.name,
        categorySlug: r.task.category.slug,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
