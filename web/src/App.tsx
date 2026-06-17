import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Layout } from '@/components/Layout';
import { RequireAuth, RequireRole } from '@/components/guards';
import { ToastViewport } from '@/store/toast';
import { PageLoader } from '@/components/ui';

import { HomePage } from '@/pages/Home';
import { BrowsePage, CategoryPage, SearchPage } from '@/pages/Catalog';
import { CourseDetailPage } from '@/pages/CourseDetail';
import { LoginPage, RegisterPage } from '@/pages/Auth';
import { MyLearningPage } from '@/pages/MyLearning';
import { PlayerPage } from '@/pages/Player';
import { CartPage, WishlistPage, CheckoutPage, OrderConfirmationPage } from '@/pages/Commerce';
import { AccountPage, NotificationsPage, OrdersPage, CertificatesPage } from '@/pages/Account';
import { InstructorDashboardPage, InstructorCoursesPage, InstructorEarningsPage } from '@/pages/Instructor';
import { CourseBuilderPage } from '@/pages/CourseBuilder';
import {
  AdminDashboardPage,
  AdminCoursesPage,
  AdminUsersPage,
  AdminCategoriesPage,
} from '@/pages/Admin';
import {
  TeachPage,
  InstructorPublicPage,
  StaticPage,
  VerifyCertificatePage,
  NotFoundPage,
} from '@/pages/Misc';

export default function App() {
  const { bootstrap, ready } = useAuth();
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <PageLoader />
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Full-screen player (no chrome) */}
        <Route
          path="/learn/:slug"
          element={
            <RequireAuth>
              <PlayerPage />
            </RequireAuth>
          }
        />

        <Route element={<Layout />}>
          {/* public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/browse" element={<BrowsePage />} />
          <Route path="/category/:slug" element={<CategoryPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/course/:slug" element={<CourseDetailPage />} />
          <Route path="/instructor-profile/:id" element={<InstructorPublicPage />} />
          <Route path="/teach" element={<TeachPage />} />
          <Route path="/verify/:serial" element={<VerifyCertificatePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/about" element={<StaticPage slug="about" />} />
          <Route path="/terms" element={<StaticPage slug="terms" />} />
          <Route path="/privacy" element={<StaticPage slug="privacy" />} />
          <Route path="/refund-policy" element={<StaticPage slug="refund-policy" />} />
          <Route path="/cookies" element={<StaticPage slug="cookies" />} />
          <Route path="/help" element={<StaticPage slug="help" />} />
          <Route path="/careers" element={<StaticPage slug="careers" />} />
          <Route path="/blog" element={<StaticPage slug="blog" />} />

          {/* student */}
          <Route path="/learning" element={<RequireAuth><MyLearningPage /></RequireAuth>} />
          <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
          <Route path="/wishlist" element={<RequireAuth><WishlistPage /></RequireAuth>} />
          <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
          <Route path="/order/:id" element={<RequireAuth><OrderConfirmationPage /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><OrdersPage /></RequireAuth>} />
          <Route path="/certificates" element={<RequireAuth><CertificatesPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />

          {/* instructor */}
          <Route path="/instructor" element={<RequireRole role="instructor"><InstructorDashboardPage /></RequireRole>} />
          <Route path="/instructor/courses" element={<RequireRole role="instructor"><InstructorCoursesPage /></RequireRole>} />
          <Route path="/instructor/courses/:id/edit" element={<RequireRole role="instructor"><CourseBuilderPage /></RequireRole>} />
          <Route path="/instructor/earnings" element={<RequireRole role="instructor"><InstructorEarningsPage /></RequireRole>} />

          {/* admin */}
          <Route path="/admin" element={<RequireRole role="admin"><AdminDashboardPage /></RequireRole>} />
          <Route path="/admin/courses" element={<RequireRole role="admin"><AdminCoursesPage /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole role="admin"><AdminUsersPage /></RequireRole>} />
          <Route path="/admin/categories" element={<RequireRole role="admin"><AdminCategoriesPage /></RequireRole>} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <ToastViewport />
    </>
  );
}
