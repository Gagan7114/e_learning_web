import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { coursesPublicRouter, instructorPublicRouter } from './modules/courses/courses.public.js';
import { instructorCoursesRouter } from './modules/courses/courses.instructor.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { learningRouter, verifyRouter } from './modules/learning/learning.routes.js';
import { reviewsRouter, qnaRouter } from './modules/engagement/reviews.routes.js';
import { meRouter, couponsRouter } from './modules/me/me.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => res.json({ ok: true, service: 'e-learning-api' }));

apiRouter.use('/auth', authRouter);
apiRouter.use('/categories', categoriesRouter);
apiRouter.use('/courses', coursesPublicRouter);
apiRouter.use('/instructors', instructorPublicRouter);

// authenticated areas
apiRouter.use('/me', meRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/orders', ordersRouter);
apiRouter.use('/learning', learningRouter);
apiRouter.use('/verify', verifyRouter);

// reviews + Q&A are mounted at root so their internal paths
// (/courses/:slug/reviews, /lectures/:id/qna, /reviews/:id, /qna/:id) resolve correctly
apiRouter.use('/', reviewsRouter);
apiRouter.use('/', qnaRouter);

// instructor studio
apiRouter.use('/instructor/courses', instructorCoursesRouter);
apiRouter.use('/instructor/coupons', couponsRouter);

// admin
apiRouter.use('/admin', adminRouter);
