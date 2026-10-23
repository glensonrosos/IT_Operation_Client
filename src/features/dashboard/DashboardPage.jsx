import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { can } from '../../utils/permissions.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="lg" sx={{ py: 5 }}>
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider' }}>
            <Typography variant="overline" color="primary.main" fontWeight={700}>{user?.role?.name}</Typography>
            <Typography variant="h4" component="h1" fontWeight={700}>Welcome, {user?.firstName}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>IT can record employee requests, manage directory records, and track operational work from one place.</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
              {(can(user, 'tickets.view') || can(user, 'tickets.view.assigned')) && <Button component={Link} to="/tickets" variant="contained">Service desk</Button>}
              {can(user, 'assets.view') && <Button component={Link} to="/assets" variant="outlined">Assets</Button>}
              {(can(user, 'borrowing.view') || can(user, 'borrowing.view.assigned')) && <Button component={Link} to="/borrowings" variant="outlined">Borrowings</Button>}
              {can(user, 'maintenance.view') && <Button component={Link} to="/maintenance" variant="outlined">Maintenance</Button>}
              {can(user, 'employees.view') && <Button component={Link} to="/employees" variant="contained">Employee directory</Button>}
              {can(user, 'departments.view') && <Button component={Link} to="/departments" variant="outlined">Departments</Button>}
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
