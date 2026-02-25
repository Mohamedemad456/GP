import { memo } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import ChatbotSheet from "./ChatbotSheet";

const Layout = memo(() => {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ChatbotSheet />
    </div>
  );
});

Layout.displayName = "Layout";

export default Layout;
