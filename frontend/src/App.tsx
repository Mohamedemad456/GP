import { lazy, Suspense, useEffect, useMemo } from "react";
import { Route, Routes } from "react-router-dom";

import { Toaster } from "@/lib";
import Layout from "./components/Layout";

// Lazy load route components for code splitting
const Home = lazy(() => import("@/pages/(public)/home"));
const About = lazy(() => import("@/pages/(public)/about"));
const Contact = lazy(() => import("@/pages/(public)/contact"));
const Login = lazy(() => import("@/pages/(auth)/login"));
const Signup = lazy(() => import("@/pages/(auth)/signup"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

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
        </Routes>
      </Suspense>
      <Toaster position={toasterPosition} richColors />
    </>
  );
}

export default App;
