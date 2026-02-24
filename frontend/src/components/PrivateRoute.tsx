import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getAuthSession, type UserRole } from "@/lib/auth";

type PrivateRouteProps = {
  allowedRoles?: UserRole[];
};

export default function PrivateRoute({ allowedRoles }: PrivateRouteProps) {
  const location = useLocation();
  const session = getAuthSession();

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

