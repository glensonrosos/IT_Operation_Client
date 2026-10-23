import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExpandMore, Menu as MenuIcon } from '@mui/icons-material';
import { AppBar, Avatar, Badge, Box, Button, Divider, IconButton, Menu, MenuItem, Stack, Toolbar, Typography } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import { apiClient } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { can } from '../utils/permissions.js';

const primaryItems = [
  ['tickets.view', 'tickets.view.assigned', '/tickets', 'Service Desk'],
  ['assets.view', null, '/assets', 'Assets'],
  ['spareParts.view', null, '/spare-parts', 'Spare parts'],
  ['maintenance.view', null, '/maintenance', 'Maintenance'],
  ['borrowing.view', 'borrowing.view.assigned', '/borrowings', 'Borrowing'],
  ['employees.view', null, '/employees', 'People']
];

export default function DirectoryNavigation() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const ticketNotificationQuery = useQuery({
    queryKey: ['ticket-notification-count'],
    enabled: Boolean(user) && (can(user, 'tickets.view') || can(user, 'tickets.view.assigned')),
    queryFn: async () => (await apiClient.get('/tickets/notification-count')).data.data.count,
    refetchInterval: 30_000,
    staleTime: 15_000
  });
  const overdueBorrowingQuery = useQuery({
    queryKey: ['navigation-overdue-borrowings'],
    enabled: Boolean(user) && can(user, 'borrowing.view'),
    queryFn: async () => (await apiClient.get('/borrowings', { params: { page: 1, limit: 1, overdue: 'true' } })).data.data.pagination?.total ?? 0,
    refetchInterval: 30_000,
    staleTime: 15_000
  });
  const openMaintenanceQuery = useQuery({
    queryKey: ['navigation-open-maintenance'],
    enabled: Boolean(user) && can(user, 'maintenance.view'),
    queryFn: async () => {
      const statuses = ['IN_PROGRESS', 'ON_HOLD', 'COMPLETING'];
      const responses = await Promise.all(statuses.map((status) => apiClient.get('/maintenance', { params: { page: 1, limit: 1, status } })));
      return responses.reduce((total, response) => total + (response.data.data.pagination?.total ?? 0), 0);
    },
    refetchInterval: 30_000,
    staleTime: 15_000
  });
  const [mobileAnchor, setMobileAnchor] = useState(null);
  const [moreAnchor, setMoreAnchor] = useState(null);
  const [userAnchor, setUserAnchor] = useState(null);
  const active = (path) => path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const permitted = (first, second = null) => can(user, first) || (second && can(user, second));
  const primary = primaryItems.filter(([first, second]) => permitted(first, second));
  const secondary = [
    [permitted('ticketCategories.manage') || can(user, 'sla.manage'), '/ticket-settings', 'Ticket setup'],
    [can(user, 'assetTypes.manage'), '/asset-setup', 'Asset setup'],
    [can(user, 'spareParts.manage'), '/spare-part-setup', 'Spare-part setup'],
    [can(user, 'maintenance.view'), '/warranties', 'Warranty'],
    [can(user, 'knowledge.view'), '/knowledge', 'Knowledge'],
    [can(user, 'reports.view'), '/reports', 'Reports'],
    [can(user, 'audit.view'), '/audit-logs', 'Audit logs'],
    [can(user, 'users.view'), '/it-accounts', 'IT accounts'],
    [can(user, 'settings.view'), '/settings', 'Settings'],
    [can(user, 'departments.view') && user?.role?.key !== 'IT_STAFF', '/departments', 'Departments']
  ].filter(([allowed]) => allowed);
  const closeMenus = () => { setMobileAnchor(null); setMoreAnchor(null); setUserAnchor(null); };

  return (
    <AppBar position="sticky" top={0} color="inherit" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.appBar, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ minHeight: { xs: 64, md: 76 }, gap: { xs: 1, md: 2 }, px: { xs: 2, md: 4 } }}>
        <IconButton onClick={(event) => setMobileAnchor(event.currentTarget)} sx={{ display: { xs: 'inline-flex', lg: 'none' } }} aria-label="Open navigation"><MenuIcon /></IconButton>
        <Box component={Link} to="/" onClick={closeMenus} sx={{ minWidth: 190, flexGrow: { xs: 1, lg: 0 }, color: 'text.primary', textDecoration: 'none' }}>
          <Typography variant="overline" color="primary.main" fontWeight={800} sx={{ display: 'block', lineHeight: 1 }}>IT Operations</Typography>
          <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.25, letterSpacing: '-0.02em' }}>Management System</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} sx={{ display: { xs: 'none', lg: 'flex' }, flex: 1, alignItems: 'center', ml: 2 }}>
          {primary.map(([, , path, label]) => <Button key={path} component={Link} to={path} onClick={closeMenus} color={active(path) ? 'primary' : 'inherit'} variant={active(path) ? 'contained' : 'text'} sx={{ borderRadius: 2, px: 1.5, fontWeight: 700 }}>{path === '/tickets' ? <Badge badgeContent={ticketNotificationQuery.data ?? 0} color="error" max={99} sx={{ '& .MuiBadge-badge': { right: -14, top: '-50%', transform: 'translate(-250%, -10%)' } }}>{label}</Badge> : path === '/borrowings' ? <Badge badgeContent={overdueBorrowingQuery.data ?? 0} color="error" max={99} sx={{ '& .MuiBadge-badge': { right: -14, top: '-50%', transform: 'translate(-250%, -10%)' } }}>{label}</Badge> : path === '/maintenance' ? <Badge badgeContent={openMaintenanceQuery.data ?? 0} color="error" max={99} sx={{ '& .MuiBadge-badge': { right: -14, top: '-50%', transform: 'translate(-250%, -10%)' } }}>{label}</Badge> : label}</Button>)}
          {secondary.length > 0 && <Button onClick={(event) => setMoreAnchor(event.currentTarget)} endIcon={<ExpandMore />} color={secondary.some(([, path]) => active(path)) ? 'primary' : 'inherit'} sx={{ borderRadius: 2, px: 1.5, fontWeight: 700 }}>Administration</Button>}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Button onClick={(event) => setUserAnchor(event.currentTarget)} sx={{ minWidth: 0, p: 0.5, borderRadius: 2, color: 'text.primary', textTransform: 'none' }} aria-label="Open account menu" aria-haspopup="menu" aria-expanded={Boolean(userAnchor)}><Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 14 }}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Avatar><Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 100, ml: 1, textAlign: 'left' }}><Typography variant="body2" fontWeight={700} noWrap>{user?.firstName} {user?.lastName}</Typography><Typography variant="caption" color="text.secondary" noWrap>{user?.role?.name}</Typography></Box><ExpandMore sx={{ display: { xs: 'none', sm: 'block' }, ml: 0.5 }} /></Button>
        </Stack>
      </Toolbar>
      <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={closeMenus} MenuListProps={{ 'aria-label': 'Administration navigation' }}>{secondary.map(([, path, label]) => <MenuItem key={path} component={Link} to={path} selected={active(path)} onClick={closeMenus}>{label}</MenuItem>)}</Menu>
      <Menu anchorEl={userAnchor} open={Boolean(userAnchor)} onClose={closeMenus} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} MenuListProps={{ 'aria-label': 'Account menu' }}><MenuItem component={Link} to="/change-password" onClick={closeMenus}>Change password</MenuItem><MenuItem onClick={() => { closeMenus(); logout().catch(() => {}); }}>Sign out</MenuItem></Menu>
      <Menu anchorEl={mobileAnchor} open={Boolean(mobileAnchor)} onClose={closeMenus} sx={{ display: { lg: 'none' } }} MenuListProps={{ 'aria-label': 'Application navigation' }}>{[...primary.map(([, , path, label]) => [path, label]), ...secondary.map(([, path, label]) => [path, label])].map(([path, label]) => <MenuItem key={path} component={Link} to={path} selected={active(path)} onClick={closeMenus}>{label}</MenuItem>)}</Menu>
    </AppBar>
  );
}
