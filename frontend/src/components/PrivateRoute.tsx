import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "@gp/design-system";
import { useAuth } from "@/context/AuthContext";
import type { UserRole } from "@/lib/auth";

type PrivateRouteProps = {
  allowedRoles?: UserRole[];
};

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
