import { and, eq, gt, lt, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { coupons } from '../../db/schema.js';
import { ApiError } from '../../utils/helpers.js';

export interface CouponResult {
  code: string;
  discountCents: number;
  couponId: string;
}

/**
 * Validate a coupon against a set of (courseId, priceCents) items and return
 * the total discount in minor units. Platform coupons apply to the whole order;
 * course coupons apply only to their course.
 */
export async function applyCoupon(
  code: string,
  items: { courseId: string; priceCents: number }[]
): Promise<CouponResult> {
  const now = new Date();
  const coupon = await db.query.coupons.findFirst({
    where: and(eq(coupons.code, code.toUpperCase()), eq(coupons.active, true)),
  });
  if (!coupon) throw new ApiError(404, 'Invalid coupon code');
  if (coupon.startsAt && coupon.startsAt > now) throw new ApiError(400, 'Coupon not active yet');
  if (coupon.expiresAt && coupon.expiresAt < now) throw new ApiError(400, 'Coupon has expired');
  if (coupon.maxUses != null && coupon.used >= coupon.maxUses)
    throw new ApiError(400, 'Coupon usage limit reached');

  // which items the coupon applies to
  const applicable =
    coupon.scope === 'platform'
      ? items
      : items.filter((i) => i.courseId === coupon.courseId);
  if (!applicable.length) throw new ApiError(400, 'Coupon does not apply to your cart');

  const base = applicable.reduce((s, i) => s + i.priceCents, 0);
  let discount =
    coupon.type === 'percent'
      ? Math.round((base * coupon.value) / 100)
      : Math.min(coupon.value, base);
  discount = Math.max(0, Math.min(discount, base));

  return { code: coupon.code, discountCents: discount, couponId: coupon.id };
}
