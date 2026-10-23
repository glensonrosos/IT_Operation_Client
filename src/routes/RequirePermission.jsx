import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../utils/permissions.js';

export default function RequirePermission({ permissions, denyRoles = [], children }) {
  const { user } = useAuth();
  const allowed = !denyRoles.includes(user?.role?.key) && permissions.some((permission) => can(user, permission));
  return allowed ? children : <Navigate to="/forbidden" replace />;
}
