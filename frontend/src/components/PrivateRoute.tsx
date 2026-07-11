import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { PageLoader } from "@gp/design-system";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";
import type { UserRole } from "@/lib/auth";

type PrivateRouteProps = {
  allowedRoles?: UserRole[];
};

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  const isUnauthorized =
    !isLoading && !!user && !!allowedRoles && !allowedRoles.includes(user.role);

  useEffect(() => {
    if (isUnauthorized) {
      toast.error("Access denied", {
        description: "You don't have permission to access that page.",
      });
    }
  }, [isUnauthorized]);

  if (isLoading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
