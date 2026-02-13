import { lazy, Suspense, useEffect, useMemo } from "react";
import { Route, Routes } from "react-router-dom";

import { Toaster } from "@/lib";
import { PageLoader } from "@gp/design-system";
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
const CarsPending = lazy(() => import("@/pages/(admin)/cars-pending"));
const SellerLayout = lazy(() => import("@/pages/(seller)/SellerLayout"));
const SellerAnalytics = lazy(() => import("@/pages/(seller)/analytics"));
const SellerListings = lazy(() => import("@/pages/(seller)/listings"));
const AddListing = lazy(() => import("@/pages/(seller)/add-listing"));

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
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="about" element={<About />} />
            <Route path="contact" element={<Contact />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Analytics />} />
            <Route path="users-pending" element={<UsersPending />} />
            <Route path="cars-pending" element={<CarsPending />} />
          </Route>
          <Route path="/seller" element={<SellerLayout />}>
            <Route index element={<SellerAnalytics />} />
            <Route path="listings" element={<SellerListings />} />
            <Route path="add-listing" element={<AddListing />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position={toasterPosition} richColors />
    </>
  );
}

export default App;
