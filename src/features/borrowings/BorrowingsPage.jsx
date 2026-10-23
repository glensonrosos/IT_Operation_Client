import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Container, FormControl, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { can } from '../../utils/permissions.js';
import BorrowingCreateDialog from './BorrowingCreateDialog.jsx';

const statuses = ['BORROWED', 'PARTIALLY_RETURNED', 'LOSS_REVIEW', 'RETURNED'];

function message(error) {
  return error?.response?.data?.message ?? 'The request could not be completed.';
}

export default function BorrowingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('BORROWED');
  const [overdue, setOverdue] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notice, setNotice] = useState({ open: false, text: '', severity: 'success' });
  const term = useDebouncedValue(search);
  const params = { page: page + 1, limit: rowsPerPage, search: term || undefined, status: status || undefined, overdue: overdue ? 'true' : undefined };
  const query = useQuery({ queryKey: ['borrowings', params], queryFn: async () => (await apiClient.get('/borrowings', { params })).data.data });
  const createMutation = useMutation({
    mutationFn: async (values) => {
      const { conditionImages = [], ...body } = values;
      const response = await apiClient.post('/borrowings', body);
      const borrowing = response.data.data.borrowing;
      if (conditionImages.length) {
        await Promise.all((borrowing.items ?? []).map(async (item) => {
          const formData = new FormData();
          conditionImages.forEach((image) => formData.append('images', image));
          formData.append('uploadedVia', 'Borrowed / Checkout');
          formData.append('borrowing', borrowing.id ?? borrowing._id);
          await apiClient.post(`/assets/${item.asset?._id ?? item.asset}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }));
      }
      return response;
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['borrowings'] });
      setCreateOpen(false);
      setNotice({ open: true, text: `Request ${response.data.data.borrowing.borrowingNumber} created.`, severity: 'success' });
    },
    onError: (error) => setNotice({ open: true, text: message(error), severity: 'error' })
  });
  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box><Typography variant="overline" color="primary.main" fontWeight={700}>Tools & Equipment</Typography><Typography variant="h4" component="h1" fontWeight={700}>Borrowings</Typography><Typography color="text.secondary">Record employee equipment requests, approvals, release, and item-by-item returns.</Typography></Box>
            {can(user, 'borrowing.create') && <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>New request</Button>}
          </Stack>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}><Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField size="small" label="Search borrowing or employee" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 210 }}><InputLabel id="borrowing-status-label">Status</InputLabel><Select labelId="borrowing-status-label" label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><MenuItem value="">All statuses</MenuItem>{statuses.map((item) => <MenuItem key={item} value={item}>{item.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="borrowing-overdue-label">Due date</InputLabel><Select labelId="borrowing-overdue-label" label="Due date" value={overdue ? 'overdue' : 'all'} onChange={(event) => { setOverdue(event.target.value === 'overdue'); setPage(0); }}><MenuItem value="all">All due dates</MenuItem><MenuItem value="overdue">Overdue only</MenuItem></Select></FormControl>
          </Stack></Paper>
          {query.isError && <Alert severity="error">{message(query.error)}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}><Table size="small"><TableHead><TableRow><TableCell>Borrowing</TableCell><TableCell>Borrower</TableCell><TableCell>Items</TableCell><TableCell>Due</TableCell><TableCell>Status</TableCell><TableCell>Overdue</TableCell></TableRow></TableHead><TableBody>
            {query.isPending ? <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} sx={{ my: 3 }} /></TableCell></TableRow> : items.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>No borrowing records match the filters.</TableCell></TableRow> : items.map((borrowing) => <TableRow hover key={borrowing.id}>
              <TableCell><Button component={Link} to={`/borrowings/${borrowing.id}`} size="small">{borrowing.borrowingNumber}</Button></TableCell>
              <TableCell>{borrowing.borrowerSnapshot?.fullName} ({borrowing.borrowerSnapshot?.employeeId})</TableCell>
              <TableCell>{borrowing.items?.length ?? 0}</TableCell>
              <TableCell>{new Date(borrowing.dueAt).toLocaleString()}</TableCell>
              <TableCell><Chip size="small" label={borrowing.status.replaceAll('_', ' ')} color={borrowing.status === 'RETURNED' ? 'success' : borrowing.status === 'LOSS_REVIEW' || borrowing.isOverdue ? 'error' : 'default'} /></TableCell>
              <TableCell>{borrowing.isOverdue ? <Chip size="small" color="error" label={`${borrowing.outstandingItemCount} item(s)`} /> : '—'}</TableCell>
            </TableRow>)}
          </TableBody></Table><TablePagination component="div" count={pagination?.total ?? 0} page={page} onPageChange={(_, value) => setPage(value)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} /></TableContainer>
        </Stack>
      </Container>
      <BorrowingCreateDialog open={createOpen} saving={createMutation.isPending} error={createMutation.error ? message(createMutation.error) : ''} onClose={() => setCreateOpen(false)} onSubmit={(values) => createMutation.mutate(values)} />
      <Snackbar open={notice.open} autoHideDuration={5000} onClose={() => setNotice((current) => ({ ...current, open: false }))}><Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.text}</Alert></Snackbar>
    </Box>
  );
}
