import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, ShoppingCart, Heart, Tag, CheckCircle2, Download } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { toast } from '@/store/toast';
import { money } from '@/lib/format';
import { PageLoader, EmptyState, Stars } from '@/components/ui';
import type { CourseCard } from '@/lib/types';

interface CartItem extends CourseCard {}

/* ------------------------------ Cart ------------------------------ */

export function CartPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api.get('/cart')).data as { items: CartItem[]; subtotalCents: number },
  });

  const remove = useMutation({
    mutationFn: async (courseId: string) => api.delete(`/cart/${courseId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['cart-count'] });
    },
  });

  if (isLoading) return <PageLoader />;
  const items = data?.items ?? [];

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-3xl font-bold">Shopping cart</h1>
      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-10 w-10" />}
          title="Your cart is empty"
          subtitle="Keep shopping to find a course."
          action={
            <Link to="/browse" className="btn-primary">
              Browse courses
            </Link>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mb-3 font-semibold">{items.length} courses in cart</p>
            <div className="divide-y rounded-lg border">
              {items.map((c) => (
                <div key={c.id} className="flex gap-4 p-4">
                  <Link to={`/course/${c.slug}`}>
                    <img src={c.image ?? ''} alt={c.title} className="h-20 w-32 rounded object-cover" />
                  </Link>
                  <div className="flex-1">
                    <Link to={`/course/${c.slug}`} className="font-bold hover:text-brand-700">
                      {c.title}
                    </Link>
                    <p className="text-xs text-ink-500">{c.instructorName}</p>
                    <div className="mt-1 flex items-center gap-1 text-xs">
                      <Stars value={c.ratingAvg} /> ({c.ratingCount})
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{c.priceCents === 0 ? 'Free' : money(c.priceCents, c.currency)}</p>
                    <button
                      onClick={() => remove.mutate(c.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="rounded-lg border p-5">
              <p className="text-sm text-ink-500">Total:</p>
              <p className="text-3xl font-extrabold">{money(data!.subtotalCents)}</p>
              <button onClick={() => navigate('/checkout')} className="btn-primary mt-4 w-full">
                Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Wishlist ---------------------------- */

export function WishlistPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await api.get('/cart/wishlist')).data.items as CartItem[],
  });
  const addToCart = useMutation({
    mutationFn: async (courseId: string) => api.post('/cart', { courseId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart-count'] });
      toast.success('Added to cart');
    },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: async (courseId: string) => api.delete(`/cart/wishlist/${courseId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist'] }),
  });

  if (isLoading) return <PageLoader />;
  const items = data ?? [];

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-3xl font-bold">Wishlist</h1>
      {items.length === 0 ? (
        <EmptyState icon={<Heart className="h-10 w-10" />} title="Your wishlist is empty" subtitle="Save courses to buy later." />
      ) : (
        <div className="divide-y rounded-lg border">
          {items.map((c) => (
            <div key={c.id} className="flex items-center gap-4 p-4">
              <img src={c.image ?? ''} alt={c.title} className="h-16 w-28 rounded object-cover" />
              <div className="flex-1">
                <Link to={`/course/${c.slug}`} className="font-bold hover:text-brand-700">
                  {c.title}
                </Link>
                <p className="text-xs text-ink-500">{c.instructorName}</p>
              </div>
              <p className="font-bold">{c.priceCents === 0 ? 'Free' : money(c.priceCents, c.currency)}</p>
              <button onClick={() => addToCart.mutate(c.id)} className="btn-primary">
                Add to cart
              </button>
              <button onClick={() => remove.mutate(c.id)} className="text-ink-500 hover:text-red-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Checkout ---------------------------- */

export function CheckoutPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<{ code: string; discountCents: number } | null>(null);
  const [provider, setProvider] = useState<'mock' | 'stripe' | 'razorpay'>('mock');

  const { data, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api.get('/cart')).data as { items: CartItem[]; subtotalCents: number },
  });

  const validate = useMutation({
    mutationFn: async () => (await api.post('/orders/validate-coupon', { code: coupon })).data,
    onSuccess: (res) => {
      setApplied({ code: res.code, discountCents: res.discountCents });
      toast.success(`Coupon ${res.code} applied`);
    },
    onError: (e) => {
      setApplied(null);
      toast.error(apiError(e));
    },
  });

  const checkout = useMutation({
    mutationFn: async () =>
      (await api.post('/orders/checkout', { couponCode: applied?.code, provider })).data,
    onSuccess: (res) => {
      qc.invalidateQueries();
      navigate(`/order/${res.order.id}`);
    },
    onError: (e) => toast.error(apiError(e)),
  });

  if (isLoading) return <PageLoader />;
  const items = data?.items ?? [];
  if (items.length === 0)
    return (
      <div className="container-page py-12">
        <EmptyState title="Nothing to check out" action={<Link to="/browse" className="btn-primary">Browse courses</Link>} />
      </div>
    );

  const subtotal = data!.subtotalCents;
  const discount = applied?.discountCents ?? 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-3xl font-bold">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* payment method */}
          <section className="rounded-lg border p-5">
            <h2 className="mb-3 font-bold">Payment method</h2>
            <div className="space-y-2">
              {([
                ['mock', 'Mock gateway (instant — for testing)'],
                ['stripe', 'Credit / Debit card (Stripe)'],
                ['razorpay', 'UPI / Wallet / Net-banking (Razorpay)'],
              ] as const).map(([val, label]) => (
                <label key={val} className="flex cursor-pointer items-center gap-2 rounded border p-3 text-sm">
                  <input type="radio" name="provider" checked={provider === val} onChange={() => setProvider(val)} className="accent-brand-600" />
                  {label}
                </label>
              ))}
            </div>
            {provider !== 'mock' && (
              <p className="mt-2 text-xs text-ink-500">
                In this MVP, real gateways are stubbed — the order settles via the mock flow. Wire up
                Stripe/Razorpay keys to enable live payments.
              </p>
            )}
          </section>

          {/* order summary items */}
          <section className="rounded-lg border p-5">
            <h2 className="mb-3 font-bold">Order details</h2>
            <div className="divide-y">
              {items.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-2">
                  <img src={c.image ?? ''} alt="" className="h-12 w-20 rounded object-cover" />
                  <span className="flex-1 text-sm font-medium">{c.title}</span>
                  <span className="text-sm">{money(c.priceCents, c.currency)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* summary */}
        <div>
          <div className="rounded-lg border p-5">
            <h2 className="mb-3 font-bold">Summary</h2>
            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Coupon (try LAUNCH50)"
                  className="input pl-8"
                />
              </div>
              <button onClick={() => coupon && validate.mutate()} className="btn-secondary shrink-0">
                Apply
              </button>
            </div>
            <dl className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-700">
                  <dt>Discount ({applied!.code})</dt>
                  <dd>-{money(discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 text-lg font-bold">
                <dt>Total</dt>
                <dd>{money(total)}</dd>
              </div>
            </dl>
            <button onClick={() => checkout.mutate()} disabled={checkout.isPending} className="btn-primary mt-4 w-full">
              {checkout.isPending ? 'Processing…' : `Pay ${money(total)}`}
            </button>
            <p className="mt-2 text-center text-xs text-ink-500">30-Day Money-Back Guarantee</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------ Order confirmation ------------------------ */

export function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data.order,
  });
  if (isLoading) return <PageLoader />;
  if (!data) return <div className="container-page py-12">Order not found.</div>;

  return (
    <div className="container-page max-w-2xl py-12">
      <div className="rounded-lg border bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-2 text-2xl font-bold">Thank you for your purchase!</h1>
        <p className="text-sm text-ink-500">Order #{String(data.id).slice(0, 8)} · {data.status}</p>
      </div>

      <div className="mt-6 rounded-lg border p-5">
        <h2 className="mb-3 font-bold">Receipt</h2>
        <div className="divide-y">
          {data.items.map((it: any) => (
            <div key={it.courseId} className="flex items-center gap-3 py-2">
              <img src={it.image ?? ''} alt="" className="h-12 w-20 rounded object-cover" />
              <span className="flex-1 text-sm font-medium">{it.title}</span>
              <Link to={`/learn/${it.slug}`} className="btn-primary py-1 text-xs">
                Start learning
              </Link>
            </div>
          ))}
        </div>
        <dl className="mt-4 space-y-1 border-t pt-3 text-sm">
          <Row label="Subtotal" value={money(data.subtotalCents)} />
          {data.discountCents > 0 && <Row label="Discount" value={`-${money(data.discountCents)}`} />}
          <div className="flex justify-between border-t pt-2 font-bold">
            <dt>Total paid</dt>
            <dd>{money(data.totalCents)}</dd>
          </div>
        </dl>
      </div>
      <div className="mt-4 flex gap-3">
        <Link to="/learning" className="btn-primary">
          Go to My Learning
        </Link>
        <Link to="/orders" className="btn-secondary">
          <Download className="h-4 w-4" /> View all orders
        </Link>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
