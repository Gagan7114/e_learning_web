import { Router } from 'express';
import { z } from 'zod';
import { eq, asc, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { categories } from '../../db/schema.js';
import { asyncHandler, ApiError, slugify } from '../../utils/helpers.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

export const categoriesRouter = Router();

// Public: full category tree (top-level with children)
categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const all = await db.select().from(categories).orderBy(asc(categories.order), asc(categories.name));
    const top = all.filter((c) => !c.parentId);
    const tree = top.map((c) => ({
      ...c,
      children: all.filter((child) => child.parentId === c.id),
    }));
    res.json({ categories: tree });
  })
);

categoriesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, req.params.slug),
    });
    if (!cat) throw new ApiError(404, 'Category not found');
    const children = await db
      .select()
      .from(categories)
      .where(eq(categories.parentId, cat.id))
      .orderBy(asc(categories.order));
    res.json({ category: { ...cat, children } });
  })
);

/* ---- admin management ---- */

const upsertSchema = z.object({
  name: z.string().min(2).max(120),
  parentId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().optional(),
});

categoriesRouter.post(
  '/',
  requireAuth,
  requireRole('admin'),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof upsertSchema>;
    const [created] = await db
      .insert(categories)
      .values({ ...data, slug: slugify(data.name) })
      .returning();
    res.status(201).json({ category: created });
  })
);

categoriesRouter.put(
  '/:id',
  requireAuth,
  requireRole('admin'),
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const data = req.body as Partial<z.infer<typeof upsertSchema>>;
    const patch: Record<string, unknown> = { ...data };
    if (data.name) patch.slug = slugify(data.name);
    const [updated] = await db
      .update(categories)
      .set(patch)
      .where(eq(categories.id, req.params.id))
      .returning();
    if (!updated) throw new ApiError(404, 'Category not found');
    res.json({ category: updated });
  })
);

categoriesRouter.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await db.delete(categories).where(eq(categories.id, req.params.id));
    res.json({ ok: true });
  })
);
