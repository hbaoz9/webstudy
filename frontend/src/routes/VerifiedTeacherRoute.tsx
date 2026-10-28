import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

export default function VerifiedTeacherRoute() {
  const location =
    useLocation();

  const { session } = useAuth();

  const isVerified = session?.role === 'teacher' && session.teacherVerificationStatus === 'verified';

  if (!isVerified) {
    return (
      <Navigate
        to="/teacher/verification"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return <Outlet />;
}
