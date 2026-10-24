import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../lib/auth.jsx';

export const homeFor = (user) => (user?.role === 'clinician' ? '/d' : '/p');

/** Not logged in -> login page. Wrong role -> that role's own home. */
export function RequireRole({ role }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return <Outlet />;
}

/** Login and Register: logged-in users go straight to their home. */
export function PublicOnly() {
  const { user } = useAuth();
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />;
}
