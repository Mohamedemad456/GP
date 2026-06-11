import { lazy, Suspense, useEffect, useMemo } from "react";
import { Route, Routes } from "react-router-dom";

import { Toaster } from "@/lib";
import { PageLoader } from "@gp/design-system";
import PrivateRoute from "./components/PrivateRoute";
import GuestRoute from "./components/GuestRoute";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Layout from "./components/Layout";

// Lazy load route components for code splitting
const Home = lazy(() => import("@/pages/(public)/home"));
const About = lazy(() => import("@/pages/(public)/about"));
const Contact = lazy(() => import("@/pages/(public)/contact"));
const Login = lazy(() => import("@/pages/(auth)/login"));
const Signup = lazy(() => import("@/pages/(auth)/signup"));
const Onboarding = lazy(() => import("@/pages/(auth)/onboarding"));
const AdminLayout = lazy(() => import("@/pages/(admin)/AdminLayout"));
const Analytics = lazy(() => import("@/pages/(admin)/analytics"));
const UsersPending = lazy(() => import("@/pages/(admin)/users-pending"));
const AdminUsers = lazy(() => import("@/pages/(admin)/users"));
const AdminActivityLogs = lazy(() => import("@/pages/(admin)/activity-logs"));
const CarsPending = lazy(() => import("@/pages/(admin)/cars-pending"));
const AdminMakes = lazy(() => import("@/pages/(admin)/makes"));
const AdminModels = lazy(() => import("@/pages/(admin)/models"));
const AdminConditions = lazy(() => import("@/pages/(admin)/conditions"));
const SellerLayout = lazy(() => import("@/pages/(seller)/SellerLayout"));
const SellerAnalytics = lazy(() => import("@/pages/(seller)/analytics"));
const SellerMyListings = lazy(() => import("@/pages/(seller)/my-listings"));
const AddListing = lazy(() => import("@/pages/(seller)/add-listing"));
const EditListing = lazy(() => import("@/pages/(seller)/edit-listing"));
const FeedPage = lazy(() => import("@/pages/(buyer)/feed"));
const CarDetailsPage = lazy(() => import("@/pages/(buyer)/car-details"));
const ProfilePage = lazy(() => import("@/pages/(buyer)/profile"));
const FavoritesPage = lazy(() => import("@/pages/(buyer)/favorites"));

function App() {
  const storedLanguage =
    typeof window !== "undefined" ? localStorage.getItem("i18nextLng") : null;

  const isArabic = storedLanguage?.startsWith("ar") ?? false;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("dir", isArabic ? "rtl" : "ltr");
    }
  }, [isArabic]);

  const toasterPosition = useMemo(
    () => (isArabic ? "bottom-left" : "bottom-right"),
    [isArabic],
  );

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="about" element={<About />} />
              <Route path="contact" element={<Contact />} />
              <Route element={<PrivateRoute />}>
                <Route path="profile" element={<ProfilePage />} />
                <Route path="feed" element={<FeedPage />} />
                <Route path="favorites" element={<FavoritesPage />} />
                <Route path="cars/:id" element={<CarDetailsPage />} />
              </Route>
            </Route>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<PrivateRoute allowedRoles={["admin"]} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Analytics />} />
                <Route path="users-pending" element={<UsersPending />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="activity-logs" element={<AdminActivityLogs />} />
                <Route path="cars-pending" element={<CarsPending />} />
                <Route path="makes" element={<AdminMakes />} />
                <Route path="models" element={<AdminModels />} />
                <Route path="conditions" element={<AdminConditions />} />
              </Route>
            </Route>
            <Route element={<PrivateRoute allowedRoles={["user", "admin"]} />}>
              <Route path="/seller" element={<SellerLayout />}>
                <Route index element={<SellerAnalytics />} />
                <Route path="my-listings" element={<SellerMyListings />} />
                <Route path="add-listing" element={<AddListing />} />
                <Route path="edit-listing/:id" element={<EditListing />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <Toaster position={toasterPosition} richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
