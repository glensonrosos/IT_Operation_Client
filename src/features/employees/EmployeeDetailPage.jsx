import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, CircularProgress, Container, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tab, Tabs, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';

const tabs = ['Overview', 'Current Assets', 'Asset History', 'Asset Transfers', 'Asset Returns', 'Current Borrowings', 'Borrowing History', 'Tickets', 'Accountability'];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const query = useQuery({
    queryKey: ['employee', id],
    queryFn: async () => (await apiClient.get(`/employees/${id}`)).data.data.employee
  });
  const employee = query.data;
  const canReadTickets = can(user, 'tickets.view') || can(user, 'tickets.view.assigned');
  const canReadAssets = can(user, 'assets.view');
  const currentAssetsQuery = useQuery({
    queryKey: ['employee-current-assets', employee?.id],
    enabled: Boolean(employee?.id) && tab === 1 && canReadAssets,
    queryFn: async () => (await apiClient.get('/assets', { params: { currentCustodian: employee.id, limit: 100 } })).data.data.items
  });
  const assetHistoryQuery = useQuery({
    queryKey: ['employee-asset-history', employee?.id],
    enabled: Boolean(employee?.id) && tab === 2 && canReadAssets,
    queryFn: async () => (await apiClient.get('/assets/assignments/by-employee/' + employee.id)).data.data.items
  });
  const assetTransfersQuery = useQuery({
    queryKey: ['employee-asset-transfers', employee?.id],
    enabled: Boolean(employee?.id) && tab === 3 && canReadAssets,
    queryFn: async () => (await apiClient.get('/asset-transfers', { params: { employee: employee.id, limit: 100 } })).data.data.items
  });
  const assetReturnsQuery = useQuery({
    queryKey: ['employee-asset-returns', employee?.id],
    enabled: Boolean(employee?.id) && tab === 4 && canReadAssets,
    queryFn: async () => (await apiClient.get('/asset-returns', { params: { employee: employee.id, limit: 100 } })).data.data.items
  });
  const canReadBorrowings = can(user, 'borrowing.view') || can(user, 'borrowing.view.assigned');
  const borrowingsQuery = useQuery({
    queryKey: ['employee-borrowings', employee?.id],
    enabled: Boolean(employee?.id) && (tab === 5 || tab === 6) && canReadBorrowings,
    queryFn: async () => (await apiClient.get('/borrowings', { params: { employee: employee.id, limit: 100 } })).data.data.items
  });
  const ticketsQuery = useQuery({
    queryKey: ['employee-tickets', employee?.id],
    enabled: Boolean(employee?.id) && tab === 7 && canReadTickets,
    queryFn: async () => (await apiClient.get('/tickets', { params: { requester: employee.id, limit: 50 } })).data.data.items
  });
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {query.isPending ? <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box> : query.isError ? <Alert severity="error">{query.error?.response?.data?.message ?? 'Unable to load employee record.'}</Alert> : employee && <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="overline" color="primary.main" fontWeight={700}>{employee.employeeId}</Typography>
                <Typography variant="h4" component="h1" fontWeight={700}>{employee.fullName}</Typography>
                <Typography color="text.secondary">{employee.position || 'Position not recorded'} · {employee.department?.departmentName ?? 'No department'}</Typography>
              </Box>
              <Chip label={employee.isArchived ? 'ARCHIVED' : employee.status.replaceAll('_', ' ')} color={employee.isArchived ? 'default' : employee.status === 'ACTIVE' ? 'success' : 'warning'} />
            </Stack>
          </Paper>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
              {tabs.map((label) => <Tab key={label} label={label} />)}
            </Tabs>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {tab === 0 ? <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>Employee information</Typography>
                  <Stack spacing={1.5}>
                    <Typography><strong>Department:</strong> {employee.department?.departmentName ?? '—'}</Typography>
                    <Typography><strong>Position:</strong> {employee.position || '—'}</Typography>
                    <Typography><strong>Email:</strong> {employee.email || '—'}</Typography>
                    <Typography><strong>Contact number:</strong> {employee.contactNumber || '—'}</Typography>
                    <Typography><strong>Location:</strong> {employee.location || '—'}</Typography>
                  </Stack>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>IT accountability</Typography>
                  <Typography color="text.secondary">Current assets, transfers, returns, and tickets are available in the related tabs. Borrowing accountability will be added in a later phase.</Typography>
                </Paper>
              </Stack> : tab === 1 ? !canReadAssets ? <Alert severity="info">Your IT role cannot view assets.</Alert> : currentAssetsQuery.isPending ? <CircularProgress size={24} /> : currentAssetsQuery.isError ? <Alert severity="error">{currentAssetsQuery.error?.response?.data?.message ?? 'Unable to load current assets.'}</Alert> : (currentAssetsQuery.data ?? []).length === 0 ? <Alert severity="info">This employee has no currently assigned assets.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Asset ID</TableCell><TableCell>Asset</TableCell><TableCell>Condition</TableCell><TableCell>Status</TableCell><TableCell>Location</TableCell></TableRow></TableHead><TableBody>{currentAssetsQuery.data.map((asset) => <TableRow key={asset.id}><TableCell><Button component={Link} to={`/assets/${asset.id}`} size="small">{asset.assetId}</Button></TableCell><TableCell>{asset.assetName}</TableCell><TableCell>{asset.condition}</TableCell><TableCell>{asset.status}</TableCell><TableCell>{asset.location || '—'}</TableCell></TableRow>)}</TableBody></Table> : tab === 2 ? !canReadAssets ? <Alert severity="info">Your IT role cannot view asset history.</Alert> : assetHistoryQuery.isPending ? <CircularProgress size={24} /> : assetHistoryQuery.isError ? <Alert severity="error">{assetHistoryQuery.error?.response?.data?.message ?? 'Unable to load asset history.'}</Alert> : (assetHistoryQuery.data ?? []).length === 0 ? <Alert severity="info">No historical asset assignments.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Asset ID</TableCell><TableCell>Asset</TableCell><TableCell>Department</TableCell><TableCell>Assigned</TableCell><TableCell>Returned</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{assetHistoryQuery.data.map((record) => <TableRow key={record._id}><TableCell><Button component={Link} to={`/assets/${record.asset?._id}`} size="small">{record.asset?.assetId ?? 'Asset'}</Button></TableCell><TableCell>{record.asset?.assetName ?? '—'}</TableCell><TableCell>{record.department?.departmentName ?? '—'}</TableCell><TableCell>{new Date(record.assignedAt).toLocaleDateString()}</TableCell><TableCell>{record.returnedAt ? new Date(record.returnedAt).toLocaleDateString() : '—'}</TableCell><TableCell>{record.isActive ? 'CURRENT' : 'PREVIOUS'}</TableCell></TableRow>)}</TableBody></Table> : tab === 3 ? !canReadAssets ? <Alert severity="info">Your IT role cannot view asset transfers.</Alert> : assetTransfersQuery.isPending ? <CircularProgress size={24} /> : assetTransfersQuery.isError ? <Alert severity="error">Unable to load asset transfers.</Alert> : (assetTransfersQuery.data ?? []).length === 0 ? <Alert severity="info">No asset transfers for this employee.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Transfer</TableCell><TableCell>Asset</TableCell><TableCell>From</TableCell><TableCell>To</TableCell><TableCell>Status</TableCell><TableCell>Requested</TableCell></TableRow></TableHead><TableBody>{assetTransfersQuery.data.map((transfer) => <TableRow key={transfer.id}><TableCell>{transfer.transferNumber}</TableCell><TableCell><Button component={Link} to={`/assets/${transfer.asset?._id}`} size="small">{transfer.asset?.assetId ?? 'Asset'}</Button></TableCell><TableCell>{transfer.fromEmployee?.fullName}</TableCell><TableCell>{transfer.toEmployee?.fullName}</TableCell><TableCell>{transfer.status}</TableCell><TableCell>{new Date(transfer.requestedAt).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table> : tab === 4 ? !canReadAssets ? <Alert severity="info">Your IT role cannot view asset returns.</Alert> : assetReturnsQuery.isPending ? <CircularProgress size={24} /> : assetReturnsQuery.isError ? <Alert severity="error">Unable to load asset returns.</Alert> : (assetReturnsQuery.data ?? []).length === 0 ? <Alert severity="info">No asset returns for this employee.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Return</TableCell><TableCell>Asset</TableCell><TableCell>Date</TableCell><TableCell>Result</TableCell><TableCell>Condition</TableCell></TableRow></TableHead><TableBody>{assetReturnsQuery.data.map((record) => <TableRow key={record.id}><TableCell>{record.returnNumber}</TableCell><TableCell><Button component={Link} to={`/assets/${record.asset?._id}`} size="small">{record.asset?.assetId ?? 'Asset'}</Button></TableCell><TableCell>{new Date(record.returnDate).toLocaleDateString()}</TableCell><TableCell>{record.result.replaceAll('_', ' ')}</TableCell><TableCell>{record.conditionAfter}</TableCell></TableRow>)}</TableBody></Table> : tab === 5 ? <Alert severity="info">Current borrowing information will be available in the Tool & Equipment Borrowing phase.</Alert> : tab === 6 ? <Alert severity="info">Borrowing history will be available in the Tool & Equipment Borrowing phase.</Alert> : tab === 5 ? !canReadBorrowings ? <Alert severity="info">Your IT role cannot view borrowings.</Alert> : borrowingsQuery.isPending ? <CircularProgress size={24} /> : borrowingsQuery.isError ? <Alert severity="error">Unable to load current borrowings.</Alert> : (borrowingsQuery.data ?? []).filter((borrowing) => ['BORROWED', 'PARTIALLY_RETURNED', 'LOSS_REVIEW'].includes(borrowing.status)).length === 0 ? <Alert severity="info">No current borrowings for this employee.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Borrowing</TableCell><TableCell>Items</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{borrowingsQuery.data.filter((borrowing) => ['BORROWED', 'PARTIALLY_RETURNED', 'LOSS_REVIEW'].includes(borrowing.status)).map((borrowing) => <TableRow key={borrowing.id}><TableCell><Button component={Link} to={`/borrowings/${borrowing.id}`} size="small">{borrowing.borrowingNumber}</Button></TableCell><TableCell>{borrowing.outstandingItemCount}</TableCell><TableCell>{new Date(borrowing.dueAt).toLocaleString()}</TableCell><TableCell>{borrowing.isOverdue ? 'OVERDUE' : borrowing.status}</TableCell></TableRow>)}</TableBody></Table> : tab === 6 ? !canReadBorrowings ? <Alert severity="info">Your IT role cannot view borrowing history.</Alert> : borrowingsQuery.isPending ? <CircularProgress size={24} /> : (borrowingsQuery.data ?? []).length === 0 ? <Alert severity="info">No borrowing history for this employee.</Alert> : <Table size="small"><TableHead><TableRow><TableCell>Borrowing</TableCell><TableCell>Items</TableCell><TableCell>Requested</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{borrowingsQuery.data.map((borrowing) => <TableRow key={borrowing.id}><TableCell><Button component={Link} to={`/borrowings/${borrowing.id}`} size="small">{borrowing.borrowingNumber}</Button></TableCell><TableCell>{borrowing.items?.length ?? 0}</TableCell><TableCell>{new Date(borrowing.requestedAt).toLocaleDateString()}</TableCell><TableCell>{new Date(borrowing.dueAt).toLocaleString()}</TableCell><TableCell>{borrowing.status}</TableCell></TableRow>)}</TableBody></Table> : tab === 7 ? !canReadTickets ? <Alert severity="info">Your IT role cannot view tickets.</Alert> : ticketsQuery.isPending ? <CircularProgress size={24} /> : ticketsQuery.isError ? <Alert severity="error">{ticketsQuery.error?.response?.data?.message ?? 'Unable to load employee tickets.'}</Alert> : (ticketsQuery.data ?? []).length === 0 ? <Alert severity="info">No tickets are recorded for this employee.</Alert> : <Stack spacing={2}><Table size="small"><TableHead><TableRow><TableCell>Ticket</TableCell><TableCell>Title</TableCell><TableCell>Priority</TableCell><TableCell>Status</TableCell><TableCell>Created</TableCell></TableRow></TableHead><TableBody>{ticketsQuery.data.map((ticket) => <TableRow key={ticket.id} hover><TableCell><Button component={Link} to={`/tickets/${ticket.id}`} size="small">{ticket.ticketNumber}</Button></TableCell><TableCell>{ticket.title}</TableCell><TableCell>{ticket.priority}</TableCell><TableCell>{ticket.status.replaceAll('_', ' ')}</TableCell><TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell></TableRow>)}</TableBody></Table><Button component={Link} to={`/tickets?requester=${employee.id}`} sx={{ alignSelf: 'flex-start' }}>View matching tickets</Button></Stack> : <Alert severity="info">{tabs[tab]} will populate as the related IT management modules are implemented. Employee records do not have portal access.</Alert>}
            </Box>
          </Paper>
        </Stack>}
      </Container>
    </Box>
  );
}
