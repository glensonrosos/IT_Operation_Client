import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AccessTime, ErrorOutline, Groups, OpenInNew, PauseCircleOutline, Refresh } from '@mui/icons-material';
import { Alert, Box, Chip, CircularProgress, Container, IconButton, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';

const priorityColor = { CRITICAL: 'error', HIGH: 'warning', MEDIUM: 'info', LOW: 'success' };
const statusColor = { OPEN: 'primary', IN_PROGRESS: 'warning', PENDING: 'secondary' };

function toDateInput(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function elapsed(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return new Date(value).toLocaleDateString();
}

function KpiCard({ label, value, color, icon, onClick }) {
  return <Paper elevation={0} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined} sx={{ p: 2.5, border: 1, borderColor: 'divider', borderTop: 4, borderTopColor: `${color}.main`, minHeight: 120, cursor: onClick ? 'pointer' : undefined, '&:hover': onClick ? { borderColor: `${color}.main`, boxShadow: 2 } : undefined }}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="overline" color="text.secondary" fontWeight={800}>{label}</Typography><Typography variant="h3" fontWeight={800} color={`${color}.main`}>{value}</Typography></Box>{icon}</Stack></Paper>;
}

export default function LiveTicketBoardPage({ publicView = false }) {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState(() => toDateInput(Date.now() - 6 * 86_400_000));
  const [toDate, setToDate] = useState(() => toDateInput(Date.now()));
  const boardQuery = useQuery({
    queryKey: ['live-ticket-board', publicView, fromDate, toDate],
    queryFn: async () => (await apiClient.get('/tickets/public-live-board', { params: { from: new Date(`${fromDate}T00:00:00`).toISOString(), to: new Date(`${toDate}T23:59:59.999`).toISOString() } })).data.data,
    refetchInterval: 15_000,
    staleTime: 10_000
  });
  const data = boardQuery.data;

  return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
    {!publicView && <DirectoryNavigation />}
    <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
          <Box><Typography variant="overline" color="primary.main" fontWeight={800}>Service Desk</Typography><Typography variant="h4" component="h1" fontWeight={800}>Live Ticket Board</Typography><Typography color="text.secondary">A real-time view of the IT team's workload, priorities, and activity.</Typography></Box>
          <Stack direction="row" spacing={1} alignItems="center"><Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>Updates every 15 seconds</Typography><Tooltip title="Refresh now"><IconButton onClick={() => boardQuery.refetch()} disabled={boardQuery.isFetching}><Refresh /></IconButton></Tooltip></Stack>
        </Stack>
        {boardQuery.isError && <Alert severity="error">Unable to load the live ticket board.</Alert>}
        {boardQuery.isPending ? <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 280 }}><CircularProgress /></Box> : data && <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 2 }}>
            <KpiCard label="Open" value={data.kpis.open} color="primary" icon={<AccessTime color="primary" />} onClick={() => navigate('/tickets?status=OPEN')} />
            <KpiCard label="In progress" value={data.kpis.inProgress} color="warning" icon={<Groups color="warning" />} onClick={() => navigate('/tickets?status=IN_PROGRESS')} />
            <KpiCard label="Pending" value={data.kpis.pending} color="secondary" icon={<PauseCircleOutline color="secondary" />} onClick={() => navigate('/tickets?status=PENDING')} />
            <KpiCard label="AT RISK" value={data.kpis.atRisk} color="warning" icon={<ErrorOutline color="warning" />} onClick={() => navigate('/tickets?status=SLA_AT_RISK,OPEN,IN_PROGRESS')} />
            <KpiCard label="BREACHED" value={data.kpis.breached} color="error" icon={<AccessTime color="error" />} onClick={() => navigate('/tickets?status=SLA_BREACHED,OPEN,IN_PROGRESS')} />
          </Box>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}><Typography variant="h6" fontWeight={800}>Live IT activity</Typography><Typography variant="body2" color="text.secondary">Recently updated active tickets</Typography></Box>
            <TableContainer sx={{ maxHeight: 390 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Technician</TableCell><TableCell>Asked for help</TableCell><TableCell>Ticket</TableCell><TableCell>Title</TableCell><TableCell>Status</TableCell><TableCell>Priority</TableCell><TableCell align="right">Last update</TableCell><TableCell align="right" /></TableRow></TableHead><TableBody>{data.activity.length ? data.activity.map((ticket) => <TableRow key={ticket.id} hover><TableCell>{ticket.assignedTo ? ticket.assignedTo.name : <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 1, bgcolor: 'error.light', color: 'error.dark', fontWeight: 700 }}>Unassigned</Box>}</TableCell><TableCell>{ticket.askedForHelp?.length ? ticket.askedForHelp.map((user) => user.name).join(', ') : '—'}</TableCell><TableCell><Typography component={Link} to={`/tickets/${ticket.id}`} color="primary.main" fontWeight={700} sx={{ textDecoration: 'none' }}>{ticket.ticketNumber}</Typography></TableCell><TableCell sx={{ maxWidth: 320 }}><Typography noWrap>{ticket.title}</Typography></TableCell><TableCell><Chip size="small" label={ticket.status.replaceAll('_', ' ')} color={statusColor[ticket.status] ?? 'default'} /></TableCell><TableCell><Chip size="small" label={ticket.priority} color={priorityColor[ticket.priority] ?? 'default'} /></TableCell><TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{elapsed(ticket.updatedAt)}</TableCell><TableCell align="right"><OpenInNew fontSize="small" color="disabled" /></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} align="center">No active ticket activity.</TableCell></TableRow>}</TableBody></Table></TableContainer>
          </Paper>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}><Typography variant="h6" fontWeight={800} gutterBottom>Priority tickets</Typography><Stack spacing={1.5}>{data.priorities.map((item) => <Stack key={item.priority} direction="row" alignItems="center" spacing={1} onClick={() => navigate(`/tickets?priority=${item.priority}&status=OPEN,IN_PROGRESS,PENDING`)} role="button" tabIndex={0} sx={{ cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'action.hover' } }}><Chip size="small" label={item.priority} color={priorityColor[item.priority]} sx={{ minWidth: 90 }} /><LinearProgress variant="determinate" value={Math.min(100, item.count / Math.max(...data.priorities.map((priority) => priority.count), 1) * 100)} sx={{ flex: 1, height: 8, borderRadius: 4 }} color={priorityColor[item.priority]} /><Typography fontWeight={800} sx={{ minWidth: 28, textAlign: 'right' }}>{item.count}</Typography></Stack>)}</Stack><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 2 }}><KpiCard label="Overdue borrowings" value={data.kpis.overdueBorrowings} color="warning" icon={<AccessTime color="warning" />} onClick={() => navigate('/borrowings?status=BORROWED')} /><KpiCard label="Open maintenance" value={data.kpis.openMaintenance} color="info" icon={<Groups color="info" />} onClick={() => navigate('/maintenance')} /></Box></Paper>
            <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1}><Typography variant="h6" fontWeight={800}>IT performance</Typography><Stack direction="row" spacing={1}><TextField label="From" type="date" size="small" value={fromDate} onChange={(event) => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} /><TextField label="To" type="date" size="small" value={toDate} onChange={(event) => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} /></Stack></Stack><Stack spacing={1}>{data.performance.length ? data.performance.map((item, index) => <Stack key={item.id} direction="row" alignItems="center" spacing={1.5}><Typography color="text.secondary" sx={{ width: 24, fontWeight: 800 }}>{index < 3 ? ['1st', '2nd', '3rd'][index] : `${index + 1}th`}</Typography><Typography fontWeight={700} sx={{ flex: 1 }}>{item.name}</Typography><Typography variant="body2" color="text.secondary">{item.tickets} tickets</Typography><Typography fontWeight={800}>{item.renderedHours} hrs</Typography></Stack>) : <Typography color="text.secondary">No assigned ticket performance data.</Typography>}</Stack></Paper>
          </Box>
          <Typography variant="caption" color="text.secondary">Last refreshed: {new Date(data.generatedAt).toLocaleTimeString()}</Typography>
        </>}
      </Stack>
    </Container>
  </Box>;
}
