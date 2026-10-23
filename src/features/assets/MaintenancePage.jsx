import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';

const statuses = ['IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const types = ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION', 'REPAIR', 'UPGRADE'];

export default function MaintenancePage() {
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [dueSoon, setDueSoon] = useState(false);
  const [view, setView] = useState('logs');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const params = { status: status || undefined, type: type || undefined, dueSoon: dueSoon ? 'true' : undefined, limit: 100 };
  const schedulesQuery = useQuery({ queryKey: ['maintenance-schedules'], queryFn: async () => (await apiClient.get('/maintenance-schedules')).data.data.schedules });
  const query = useQuery({ queryKey: ['maintenance', params], queryFn: async () => (await apiClient.get('/maintenance', { params })).data.data });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box><Typography variant="overline" color="primary.main" fontWeight={700}>Asset Management</Typography><Typography variant="h4" component="h1" fontWeight={700}>Maintenance</Typography><Typography color="text.secondary">Track preventive service, repairs, vendor work, costs, and upcoming maintenance.</Typography></Box>
          <ToggleButtonGroup value={view} exclusive onChange={(_, value) => { if (value) { setView(value); setPage(0); } }} size="small" sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper' }}><ToggleButton value="logs" sx={{ px: 2, fontWeight: 700 }}>Log maintenance</ToggleButton><ToggleButton value="schedules" sx={{ px: 2, fontWeight: 700 }}>Routine schedules</ToggleButton></ToggleButtonGroup>{view === 'schedules' ? <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}><Table><TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Record</TableCell><TableCell>Title</TableCell><TableCell>Maintenance plan</TableCell><TableCell>Frequency</TableCell><TableCell>Next run</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{(schedulesQuery.data ?? []).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((item) => <TableRow key={item.id}><TableCell><Button component={Link} to={`/assets/${item.asset}?tab=maintenance`} size="small">{item.assetId}</Button></TableCell><TableCell>{item.scheduleNumber || item.id}</TableCell><TableCell>{item.title}</TableCell><TableCell>{item.description}</TableCell><TableCell>{item.frequency.replaceAll('_', ' ')}</TableCell><TableCell>{new Date(item.nextRunAt).toLocaleString()}</TableCell><TableCell>{item.status ?? (item.isActive ? 'ACTIVE' : 'PAUSED')}</TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={(schedulesQuery.data ?? []).length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></TableContainer> : <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="maintenance-status-filter">Status</InputLabel><Select labelId="maintenance-status-filter" label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><MenuItem value="">All statuses</MenuItem>{statuses.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="maintenance-type-filter">Type</InputLabel><Select labelId="maintenance-type-filter" label="Type" value={type} onChange={(event) => { setType(event.target.value); setPage(0); }}><MenuItem value="">All types</MenuItem>{types.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="maintenance-due-filter">Schedule</InputLabel><Select labelId="maintenance-due-filter" label="Schedule" value={dueSoon ? 'due' : 'all'} onChange={(event) => { setDueSoon(event.target.value === 'due'); setPage(0); }}><MenuItem value="all">All records</MenuItem><MenuItem value="due">Next maintenance within 30 days</MenuItem></Select></FormControl>
          </Stack></Paper>}
          {view === 'logs' && <>
          {query.isError && <Alert severity="error">{query.error?.response?.data?.message ?? 'Unable to load maintenance records.'}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}><Table><TableHead><TableRow><TableCell>Record</TableCell><TableCell>Asset</TableCell><TableCell>Type</TableCell><TableCell>Title</TableCell><TableCell>Status</TableCell><TableCell>Reported</TableCell><TableCell>Vendor</TableCell><TableCell>Next service</TableCell></TableRow></TableHead><TableBody>
            {query.isPending ? <TableRow><TableCell colSpan={8} align="center">Loading maintenance records…</TableCell></TableRow> : (query.data?.items ?? []).length === 0 ? <TableRow><TableCell colSpan={8} align="center">No maintenance records match these filters.</TableCell></TableRow> : query.data.items.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record) => <TableRow key={record.id} hover><TableCell>{record.maintenanceNumber}</TableCell><TableCell><Button component={Link} to={`/assets/${record.asset?._id}?tab=maintenance`}>{record.asset?.assetId ?? record.assetId}</Button></TableCell><TableCell>{record.type}</TableCell><TableCell>{record.title}</TableCell><TableCell><Chip size="small" label={record.status.replaceAll('_', ' ')} color={record.status === 'COMPLETED' ? 'success' : record.status === 'CANCELLED' ? 'default' : 'warning'} /></TableCell><TableCell>{new Date(record.reportedAt).toLocaleDateString()}</TableCell><TableCell>{record.vendor || '—'}</TableCell><TableCell>{record.nextMaintenanceAt ? new Date(record.nextMaintenanceAt).toLocaleDateString() : '—'}</TableCell></TableRow>)}
          </TableBody></Table><TablePagination component="div" count={query.data?.pagination?.total ?? (query.data?.items ?? []).length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></TableContainer></>}
        </Stack>
      </Container>
    </Box>
  );
}
