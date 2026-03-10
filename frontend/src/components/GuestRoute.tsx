import { Navigate, Outlet } from "react-router-dom";
import { PageLoader } from "@gp/design-system";
import { useAuth } from "@/context/AuthContext";

export default function GuestRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;

  if (user) return <Navigate to="/feed" replace />;

  return <Outlet />;
}
