import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add, OpenInNew } from '@mui/icons-material';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, FormControl, InputLabel, ListItemText, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Tooltip, Typography } from '@mui/material';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { can } from '../../utils/permissions.js';
import TicketCreateDialog from './TicketCreateDialog.jsx';

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const types = ['INCIDENT', 'SERVICE_REQUEST', 'ASSET_REQUEST', 'ACCESS_REQUEST', 'SECURITY_INCIDENT', 'CHANGE_REQUEST', 'MAINTENANCE', 'OTHER'];
const statuses = ['OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED', 'CANCELLED', 'DUPLICATED', 'SLA_MET', 'SLA_AT_RISK', 'SLA_BREACHED'];

function ticketChipColor(status) {
  if (status === 'CRITICAL' || status === 'SLA_BREACHED') return 'error';
  if (status === 'HIGH' || status === 'SLA_AT_RISK') return 'warning';
  if (status === 'MEDIUM') return 'info';
  if (status === 'LOW' || status === 'SLA_MET') return 'success';
  return 'default';
}

function statusColor(status) {
  if (status === 'OPEN') return 'primary';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'PENDING') return 'secondary';
  if (status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'error';
  if (status === 'DUPLICATED') return 'default';
  return 'default';
}

function slaTooltip(status) {
  switch (status) {
    case 'SLA_MET': return 'Resolved or on track before the resolution due date.';
    case 'SLA_BREACHED': return 'Resolution due date has passed or the ticket was closed after the deadline.';
    case 'SLA_AT_RISK': return 'Due date is approaching and the ticket may breach soon.';
    case 'SLA_CANCELLED': return 'Ticket cancelled; SLA not tracked.';
    default: return status;
  }
}

function formatHoursRendered(ticket) {
  const hours = Number(ticket.estimatedResolutionHours ?? 0);
  const minutes = Number(ticket.estimatedResolutionMinutes ?? 0);
  if (hours === 0 && minutes === 0) return '—';
  if (minutes === 0) return `${hours}h`;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

function isOverdue(ticket) {
  if (!ticket.resolutionDueAt || ['CLOSED', 'CANCELLED', 'DUPLICATED'].includes(ticket.status)) return false;
  return new Date(ticket.resolutionDueAt) < new Date();
}

function formatStatusFilter(status) {
  return status.startsWith('SLA_') ? status.replace('SLA_', '').replaceAll('_', ' ') : status.replaceAll('_', ' ');
}

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

export default function TicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(() => searchParams.get('status')?.split(',').filter(Boolean) ?? []);
  const [priority, setPriority] = useState(() => searchParams.get('priority')?.split(',').filter(Boolean) ?? []);
  const [ticketType, setTicketType] = useState('');
  const [category, setCategory] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedTo, setAssignedTo] = useState([]);
  const [askedForHelp, setAskedForHelp] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const searchTerm = useDebouncedValue(search);
  const departmentsQuery = useQuery({
    queryKey: ['departments', { page: 1, limit: 100 }],
    queryFn: async () => (await apiClient.get('/departments', { params: { limit: 100 } })).data.data.items
  });
  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories-active'],
    queryFn: async () => (await apiClient.get('/ticket-categories')).data.data.items
  });
  const assigneesQuery = useQuery({
    queryKey: ['ticket-assignable-users', can(user, 'tickets.assign')],
    enabled: can(user, 'tickets.view') || can(user, 'tickets.view.assigned'),
    queryFn: async () => (await apiClient.get(can(user, 'tickets.assign') ? '/tickets/assignable-users' : '/tickets/mentionable-users')).data.data.items
  });
  const askableQuery = useQuery({
    queryKey: ['ticket-mentionable-users'],
    enabled: can(user, 'tickets.update'),
    queryFn: async () => (await apiClient.get('/tickets/mentionable-users')).data.data.items
  });
  const params = {
    page: page + 1, limit: rowsPerPage, search: searchTerm || undefined, status: status.length ? status.join(',') : undefined,
    priority: priority.length ? priority.join(',') : undefined, type: ticketType || undefined, category: category || undefined,
    department: department || undefined, assignedTo: assignedTo.length ? assignedTo.join(',') : undefined,
    askedForHelp: askedForHelp.length ? askedForHelp.join(',') : undefined,
    requester: searchParams.get('requester') || undefined,
    from: fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : undefined,
    sortBy, sortOrder
  };
  const ticketsQuery = useQuery({
    queryKey: ['tickets', params],
    queryFn: async () => (await apiClient.get('/tickets', { params })).data.data
  });
  const createMutation = useMutation({
    mutationFn: async (values) => (await apiClient.post('/tickets', values)).data.data.ticket,
    onSuccess: (ticket) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setCreateOpen(false);
      setCreateError('');
      navigate(`/tickets/${ticket.id}`);
    },
    onError: (error) => setCreateError(errorMessage(error))
  });
  const handleSort = (field) => {
    setSortOrder(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
    setSortBy(field);
    setPage(0);
  };
  const clearFilters = () => {
    setSearch('');
    setStatus([]);
    setPriority([]);
    setTicketType('');
    setCategory('');
    setDepartment('');
    setAssignedTo([]);
    setAskedForHelp([]);
    setFromDate('');
    setToDate('');
    setPage(0);
  };
  const rows = ticketsQuery.data?.items ?? [];
  const pagination = ticketsQuery.data?.pagination;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={700}>Service Desk</Typography>
              <Typography variant="h4" component="h1" fontWeight={700}>Tickets</Typography>
              <Typography color="text.secondary">Track incidents and requests entered by IT for employees.</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              {/* {(can(user, 'ticketCategories.manage') || can(user, 'sla.manage')) && <Button component={Link} to="/ticket-settings" variant="outlined">Ticket setup</Button>} */}
              <Button variant="outlined" startIcon={<OpenInNew />} onClick={() => window.open('/live-ticket-board', '_blank', 'noopener,noreferrer')}>Live ticket board</Button>
              {can(user, 'tickets.create') && can(user, 'employees.view') && <Button variant="contained" startIcon={<Add />} onClick={() => { setCreateError(''); setCreateOpen(true); }}>Create ticket</Button>}
            </Stack>
          </Stack>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <TextField label="Search ticket, requester, or title" size="small" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} sx={{ minWidth: 250, flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 175 }}><InputLabel id="ticket-status-filter-label">Status</InputLabel><Select labelId="ticket-status-filter-label" label="Status" multiple value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} renderValue={(selected) => { if (selected.length === 0) return <em>All statuses</em>; return selected.map(formatStatusFilter).join(', '); }}>{statuses.map((value) => <MenuItem key={value} value={value}><Checkbox checked={status.includes(value)} /><ListItemText primary={formatStatusFilter(value)} /></MenuItem>)}</Select></FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel id="ticket-priority-filter-label">Priority</InputLabel><Select labelId="ticket-priority-filter-label" label="Priority" multiple value={priority} onChange={(event) => { setPriority(event.target.value); setPage(0); }} renderValue={(selected) => { if (selected.length === 0) return <em>All priorities</em>; return selected.join(', '); }}>{priorities.map((value) => <MenuItem key={value} value={value}><Checkbox checked={priority.includes(value)} /><ListItemText primary={value} /></MenuItem>)}</Select></FormControl>
              <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="ticket-department-filter-label">Department</InputLabel><Select labelId="ticket-department-filter-label" label="Department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(0); }}><MenuItem value="">All departments</MenuItem>{(departmentsQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.departmentName}</MenuItem>)}</Select></FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="ticket-type-filter-label">Type</InputLabel><Select labelId="ticket-type-filter-label" label="Type" value={ticketType} onChange={(event) => { setTicketType(event.target.value); setPage(0); }}><MenuItem value="">All types</MenuItem>{types.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
              <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="ticket-category-filter-label">Category</InputLabel><Select labelId="ticket-category-filter-label" label="Category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(0); }}><MenuItem value="">All categories</MenuItem>{(categoriesQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</Select></FormControl>
              {(can(user, 'tickets.view') || can(user, 'tickets.view.assigned')) && <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="ticket-assignee-filter-label">Assignee</InputLabel><Select labelId="ticket-assignee-filter-label" label="Assignee" multiple value={assignedTo} onChange={(event) => { setAssignedTo(event.target.value); setPage(0); }} renderValue={(selected) => { if (selected.length === 0) return <em>All assignees</em>; const unassigned = selected.includes('unassigned'); const names = (assigneesQuery.data ?? []).filter((item) => selected.includes(item.id)).map((item) => item.name); if (unassigned) names.unshift('Unassigned'); return names.join(', '); }}><MenuItem value="unassigned"><Checkbox checked={assignedTo.includes('unassigned')} /><ListItemText primary="Unassigned" /></MenuItem>{(assigneesQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}><Checkbox checked={assignedTo.includes(item.id)} /><ListItemText primary={item.name} /></MenuItem>)}</Select></FormControl>}
              {can(user, 'tickets.update') && <FormControl size="small" sx={{ minWidth: 200 }}><InputLabel id="ticket-asked-for-help-filter-label">Asked for help</InputLabel><Select labelId="ticket-asked-for-help-filter-label" label="Asked for help" multiple value={askedForHelp} onChange={(event) => { setAskedForHelp(event.target.value); setPage(0); }} renderValue={(selected) => { if (selected.length === 0) return <em>All asked</em>; const names = (askableQuery.data ?? []).filter((item) => selected.includes(item.id)).map((item) => item.name); return names.join(', '); }}>{(askableQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}><Checkbox checked={askedForHelp.includes(item.id)} /><ListItemText primary={item.name} /></MenuItem>)}</Select></FormControl>}
              <TextField label="Created from" type="date" size="small" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} />
              <TextField label="Created to" type="date" size="small" InputLabelProps={{ shrink: true }} value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); }} />
              <Button variant="outlined" size="small" onClick={clearFilters} sx={{ alignSelf: 'flex-start' }}>Clear filters</Button>
            </Stack>
          </Paper>
          {ticketsQuery.isError && <Alert severity="error">{errorMessage(ticketsQuery.error)}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell><TableSortLabel active={sortBy === 'ticketNumber'} direction={sortBy === 'ticketNumber' ? sortOrder : 'asc'} onClick={() => handleSort('ticketNumber')}>Ticket</TableSortLabel></TableCell>
                <TableCell>Requester</TableCell><TableCell>Department</TableCell><TableCell>Category</TableCell>
                <TableCell><TableSortLabel active={sortBy === 'priority'} direction={sortBy === 'priority' ? sortOrder : 'asc'} onClick={() => handleSort('priority')}>Priority</TableSortLabel></TableCell>
                <TableCell><TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortOrder : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel></TableCell>
                <TableCell>Assignee</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Asked for help</TableCell>
                <TableCell><TableSortLabel active={sortBy === 'createdAt'} direction={sortBy === 'createdAt' ? sortOrder : 'asc'} onClick={() => handleSort('createdAt')}>Created</TableSortLabel></TableCell>
                <TableCell>Hours rendered</TableCell>
                <TableCell><TableSortLabel active={sortBy === 'dueAt'} direction={sortBy === 'dueAt' ? sortOrder : 'asc'} onClick={() => handleSort('dueAt')}>Resolution due</TableSortLabel></TableCell>
                
              </TableRow></TableHead>
              <TableBody>
                {ticketsQuery.isPending ? <TableRow><TableCell colSpan={11} align="center"><CircularProgress size={24} sx={{ my: 3 }} /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>No tickets match these filters.</TableCell></TableRow> : rows.map((ticket) => (
                  <TableRow hover key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)} sx={{ cursor: 'pointer', backgroundColor: isOverdue(ticket) ? 'rgba(244, 67, 54, 0.08)' : undefined }}>
                    <TableCell><Stack><Typography color="primary.main" fontWeight={700}>{ticket.ticketNumber}</Typography><Typography variant="body2" color="text.secondary">{ticket.title}</Typography></Stack></TableCell>
                    <TableCell>{ticket.requesterSnapshot.fullName}<Typography display="block" variant="caption" color="text.secondary">{ticket.requesterSnapshot.employeeId}</Typography></TableCell>
                    <TableCell>{ticket.requesterSnapshot.departmentName || ticket.department?.departmentName || '—'}</TableCell>
                    <TableCell>{ticket.categoryNameSnapshot}</TableCell>
                    <TableCell><Chip size="small" label={ticket.priority} color={ticketChipColor(ticket.priority)} /></TableCell>
                    <TableCell><Stack spacing={0.5} alignItems="flex-start"><Chip size="small" label={ticket.status.replaceAll('_', ' ')} color={statusColor(ticket.status)} /><Tooltip title={slaTooltip(ticket.slaStatus)} arrow><Chip size="small" variant="outlined" label={ticket.slaStatus.replaceAll('SLA_', '')} color={ticketChipColor(ticket.slaStatus)} /></Tooltip></Stack></TableCell>
                    <TableCell>{ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: 'error.light', color: 'error.dark', fontWeight: 700 }}>Unassigned</Box>}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>{ticket.askedForHelp?.length ? ticket.askedForHelp.map((person) => `${person.firstName} ${person.lastName}`).join(', ') : '—'}</TableCell>
                    <TableCell>{new Date(ticket.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{formatHoursRendered(ticket)}</TableCell>
                    <TableCell>{ticket.resolutionDueAt ? new Date(ticket.resolutionDueAt).toLocaleString() : '—'}</TableCell>
                                      </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination component="div" count={pagination?.total ?? 0} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} />
          </TableContainer>
        </Stack>
      </Container>
      <TicketCreateDialog open={createOpen} saving={createMutation.isPending} error={createError} canLinkAssets={can(user, 'assets.view')} canAssign={can(user, 'tickets.assign')} onClose={() => setCreateOpen(false)} onSubmit={(values) => createMutation.mutate(values)} />
    </Box>
  );
}
