import { useState } from 'react';
import { PortalProvider, usePortal } from './services/portalContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/ToastContainer';
import { FirebaseSetupGuide } from './components/common/FirebaseSetupGuide';
import { AppShell, type AppRoute } from './components/layout/AppShell';
import { UstazPortalHome } from './components/ustaz/UstazPortalHome';
import { UstazDashboard } from './components/ustaz/UstazDashboard';
import { GradeInputPage } from './components/ustaz/GradeInputPage';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import { AdminDashboardHome } from './components/admin/AdminDashboardHome';
import { AdminStudentsPage } from './components/admin/AdminStudentsPage';
import { AdminUstazPage } from './components/admin/AdminUstazPage';
import { AdminSubjectsPage } from './components/admin/AdminSubjectsPage';
import { AdminAssignmentsPage } from './components/admin/AdminAssignmentsPage';
import { AdminMonitoringPage } from './components/admin/AdminMonitoringPage';
import { AdminRecapPage } from './components/admin/AdminRecapPage';
import { AdminSettingsPage } from './components/admin/AdminSettingsPage';

function PortalRouter() {
  const { firebaseReady, adminSession, ustazSession } = usePortal();
  const [route, setRoute] = useState<AppRoute>('portal');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string>('');

  if (!firebaseReady) {
    return <FirebaseSetupGuide />;
  }

  const navigate = (target: AppRoute) => {
    if (target.startsWith('admin-') && target !== 'admin-login') {
      if (!adminSession || adminSession.mustChangePassword) {
        setRoute('admin-login');
        return;
      }
    }
    if (target === 'ustaz-dashboard' && !ustazSession) {
      setRoute('portal');
      return;
    }
    setRoute(target);
  };

  return (
    <AppShell route={route} onNavigate={navigate}>
      {route === 'portal' && (
        <UstazPortalHome
          onSuccessLogin={() => setRoute('ustaz-dashboard')}
          onOpenAdminLogin={() =>
            navigate(adminSession && !adminSession.mustChangePassword ? 'admin-dashboard' : 'admin-login')
          }
        />
      )}

      {route === 'ustaz-dashboard' && (
        <UstazDashboard
          onBackHome={() => navigate('portal')}
          onSelectAssignment={(assignment) => {
            setActiveAssignmentId(assignment.id);
            navigate('ustaz-grading');
          }}
        />
      )}

      {route === 'ustaz-grading' && (
        <GradeInputPage
          assignmentId={activeAssignmentId}
          onBackDashboard={() => navigate('ustaz-dashboard')}
        />
      )}

      {route === 'admin-login' && (
        <AdminLoginPage
          onSuccess={() => setRoute('admin-dashboard')}
          onCancel={() => navigate('portal')}
        />
      )}

      {route === 'admin-dashboard' && <AdminDashboardHome onNavigate={navigate} />}
      {route === 'admin-students' && <AdminStudentsPage />}
      {route === 'admin-ustaz' && <AdminUstazPage />}
      {route === 'admin-subjects' && <AdminSubjectsPage />}
      {route === 'admin-assignments' && <AdminAssignmentsPage />}
      {route === 'admin-monitoring' && <AdminMonitoringPage />}
      {route === 'admin-recap' && <AdminRecapPage />}
      {route === 'admin-settings' && <AdminSettingsPage />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PortalProvider>
        <PortalRouter />
        <ToastContainer />
      </PortalProvider>
    </ErrorBoundary>
  );
}
