import { lazy, memo, Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

const ChatbotSheet = lazy(() => import("./ChatbotSheet"));

const Layout = memo(() => {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <Suspense fallback={null}>
        <ChatbotSheet />
      </Suspense>
    </div>
  );
});

Layout.displayName = "Layout";

export default Layout;
