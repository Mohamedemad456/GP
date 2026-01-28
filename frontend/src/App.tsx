import { useEffect, useMemo } from "react";
import { Route, Routes } from "react-router-dom";

import { Toaster } from "@/lib";
import Login from "@/pages/(auth)/login";
import Signup from "@/pages/(auth)/signup";
import Home from "@/pages/(public)/home";
import About from "@/pages/(public)/about";
import Contact from "@/pages/(public)/contact";
import Layout from "./components/Layout";

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
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
      </Routes>
      <Toaster position={toasterPosition} richColors />
    </>
  );
}

export default App;
