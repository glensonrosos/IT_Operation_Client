import { lazy, Suspense } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import RequireAuth from './routes/RequireAuth.jsx';
import RequirePermission from './routes/RequirePermission.jsx';

const ChangePasswordPage = lazy(() => import('./features/auth/ChangePasswordPage.jsx'));
const LoginPage = lazy(() => import('./features/auth/LoginPage.jsx'));
const ForbiddenPage = lazy(() => import('./features/auth/ForbiddenPage.jsx'));
const EmployeesPage = lazy(() => import('./features/employees/EmployeesPage.jsx'));
const EmployeeDetailPage = lazy(() => import('./features/employees/EmployeeDetailPage.jsx'));
const DepartmentsPage = lazy(() => import('./features/departments/DepartmentsPage.jsx'));
const TicketsPage = lazy(() => import('./features/tickets/TicketsPage.jsx'));
const LiveTicketBoardPage = lazy(() => import('./features/tickets/LiveTicketBoardPage.jsx'));
const TicketDetailPage = lazy(() => import('./features/tickets/TicketDetailPage.jsx'));
const TicketSettingsPage = lazy(() => import('./features/tickets/TicketSettingsPage.jsx'));
const AssetsPage = lazy(() => import('./features/assets/AssetsPage.jsx'));
const AssetTypesPage = lazy(() => import('./features/assets/AssetTypesPage.jsx'));
const SparePartsPage = lazy(() => import('./features/assets/SparePartsPage.jsx'));
const SparePartTypesPage = lazy(() => import('./features/assets/SparePartTypesPage.jsx'));
const AssetDetailPage = lazy(() => import('./features/assets/AssetDetailPage.jsx'));
const BorrowingsPage = lazy(() => import('./features/borrowings/BorrowingsPage.jsx'));
const BorrowingDetailPage = lazy(() => import('./features/borrowings/BorrowingDetailPage.jsx'));
const MaintenancePage = lazy(() => import('./features/assets/MaintenancePage.jsx'));
const WarrantiesPage = lazy(() => import('./features/assets/WarrantiesPage.jsx'));
const UsersPage = lazy(() => import('./features/admin/UsersPage.jsx'));
const SettingsPage = lazy(() => import('./features/admin/SettingsPage.jsx'));

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/live-ticket-board" element={<LiveTicketBoardPage publicView />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Navigate to="/tickets" replace />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/employees" element={<RequirePermission permissions={['employees.view']}><EmployeesPage /></RequirePermission>} />
            <Route path="/employees/:id" element={<RequirePermission permissions={['employees.view']}><EmployeeDetailPage /></RequirePermission>} />
            <Route path="/departments" element={<RequirePermission permissions={['departments.view']} denyRoles={['IT_STAFF']}><DepartmentsPage /></RequirePermission>} />
            <Route path="/assets" element={<RequirePermission permissions={['assets.view']}><AssetsPage /></RequirePermission>} />
            <Route path="/assets/:id" element={<RequirePermission permissions={['assets.view']}><AssetDetailPage /></RequirePermission>} />
            <Route path="/asset-setup" element={<RequirePermission permissions={['assetTypes.manage']}><AssetTypesPage /></RequirePermission>} />
            <Route path="/spare-parts" element={<RequirePermission permissions={['spareParts.view']}><SparePartsPage /></RequirePermission>} />
            <Route path="/spare-part-setup" element={<RequirePermission permissions={['spareParts.manage']}><SparePartTypesPage /></RequirePermission>} />
            <Route path="/borrowings" element={<RequirePermission permissions={['borrowing.view', 'borrowing.view.assigned']}><BorrowingsPage /></RequirePermission>} />
            <Route path="/borrowings/:id" element={<RequirePermission permissions={['borrowing.view', 'borrowing.view.assigned']}><BorrowingDetailPage /></RequirePermission>} />
            <Route path="/maintenance" element={<RequirePermission permissions={['maintenance.view']}><MaintenancePage /></RequirePermission>} />
            <Route path="/warranties" element={<RequirePermission permissions={['maintenance.view']}><WarrantiesPage /></RequirePermission>} />
            <Route path="/it-accounts" element={<RequirePermission permissions={['users.view']}><UsersPage /></RequirePermission>} />
            <Route path="/settings" element={<RequirePermission permissions={['settings.view']}><SettingsPage /></RequirePermission>} />
            <Route path="/tickets" element={<RequirePermission permissions={['tickets.view', 'tickets.view.assigned']}><TicketsPage /></RequirePermission>} />
            <Route path="/tickets/:id" element={<RequirePermission permissions={['tickets.view', 'tickets.view.assigned']}><TicketDetailPage /></RequirePermission>} />
            <Route path="/ticket-settings" element={<RequirePermission permissions={['ticketCategories.manage', 'sla.manage']}><TicketSettingsPage /></RequirePermission>} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
