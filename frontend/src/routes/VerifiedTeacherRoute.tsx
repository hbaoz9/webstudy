import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import {
  useTeacherAccount,
} from '../contexts/TeacherAccountContext';

export default function VerifiedTeacherRoute() {
  const location =
    useLocation();

  const {
    teacherAccount,
  } = useTeacherAccount();

  const isVerified =
    teacherAccount
      .verificationStatus ===
    'verified';

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