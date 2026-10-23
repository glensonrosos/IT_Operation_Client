import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add, DeleteOutline, EditOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { can } from '../../utils/permissions.js';
import DepartmentFormDialog from './DepartmentFormDialog.jsx';

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('departmentName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [confirmDepartment, setConfirmDepartment] = useState(null);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const searchTerm = useDebouncedValue(search);
  const params = { page: page + 1, limit: 15, search: searchTerm || undefined, status: status || undefined, sortBy, sortOrder };
  const departmentsQuery = useQuery({
    queryKey: ['departments', params],
    queryFn: async () => (await apiClient.get('/departments', { params })).data.data
  });
  const saveMutation = useMutation({
    mutationFn: async ({ id, values }) => id
      ? apiClient.patch(`/departments/${id}`, Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'departmentCode')))
      : apiClient.post('/departments', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDialogOpen(false);
      setEditingDepartment(null);
      setNotice({ open: true, message: editingDepartment ? 'Department updated.' : 'Department created.', severity: 'success' });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/departments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setConfirmDepartment(null);
      setNotice({ open: true, message: 'Department deleted.', severity: 'success' });
    },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });

  const handleSort = (field) => {
    setSortOrder(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
    setSortBy(field);
    setPage(0);
  };
  const submitForm = async (values) => {
    try {
      await saveMutation.mutateAsync({ id: editingDepartment?.id, values });
    } catch (error) {
      setNotice({ open: true, message: errorMessage(error), severity: 'error' });
    }
  };
  const rows = departmentsQuery.data?.items ?? [];
  const pagination = departmentsQuery.data?.pagination;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={700}>People</Typography>
              <Typography variant="h4" component="h1" fontWeight={700}>Departments</Typography>
              <Typography color="text.secondary">Organizational directory and employee department references.</Typography>
            </Box>
            {can(user, 'departments.create') && <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingDepartment(null); setDialogOpen(true); }}>Add department</Button>}
          </Stack>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Search code, department, or location" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} size="small" sx={{ minWidth: 260, flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="department-status-filter-label">Status</InputLabel>
                <Select labelId="department-status-filter-label" label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
                  <MenuItem value="">All statuses</MenuItem><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>

            </Stack>
          </Paper>
          {departmentsQuery.isError && <Alert severity="error">{errorMessage(departmentsQuery.error)}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Table>
              <TableHead><TableRow>
                <TableCell><TableSortLabel active={sortBy === 'departmentName'} direction={sortBy === 'departmentName' ? sortOrder : 'asc'} onClick={() => handleSort('departmentName')}>Department</TableSortLabel></TableCell>
                <TableCell><TableSortLabel active={sortBy === 'departmentCode'} direction={sortBy === 'departmentCode' ? sortOrder : 'asc'} onClick={() => handleSort('departmentCode')}>Code</TableSortLabel></TableCell>
                <TableCell>Department head</TableCell><TableCell>Location</TableCell>
                <TableCell><TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortOrder : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel></TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {departmentsQuery.isPending ? <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} sx={{ my: 3 }} /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>No departments found.</TableCell></TableRow> : rows.map((department) => (
                  <TableRow hover key={department.id}>
                    <TableCell><Stack><Typography fontWeight={600}>{department.departmentName}</Typography><Typography variant="body2" color="text.secondary">{department.description || 'No description'}</Typography></Stack></TableCell>
                    <TableCell>{department.departmentCode}</TableCell>
                    <TableCell>{department.departmentHead?.fullName ?? '—'}</TableCell>
                    <TableCell>{department.location || '—'}</TableCell>
                    <TableCell><Chip size="small" label={department.status} color={department.status === 'ACTIVE' ? 'success' : 'warning'} /></TableCell>
                    <TableCell align="right"><Stack direction="row" justifyContent="flex-end">
                      {can(user, 'departments.update') && <Button size="small" startIcon={<EditOutlined />} onClick={() => { setEditingDepartment(department); setDialogOpen(true); }}>Edit</Button>}
                      {can(user, 'departments.delete') && <Button size="small" color="error" startIcon={<DeleteOutline />} onClick={() => setConfirmDepartment(department)}>Delete</Button>}
                    </Stack></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination component="div" count={pagination?.total ?? 0} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={15} rowsPerPageOptions={[15]} />
          </TableContainer>
        </Stack>
      </Container>
      <DepartmentFormDialog open={dialogOpen} department={editingDepartment} saving={saveMutation.isPending} onClose={() => setDialogOpen(false)} onSubmit={submitForm} />
      <Dialog open={Boolean(confirmDepartment)} onClose={() => setConfirmDepartment(null)}>
        <DialogTitle>Delete department?</DialogTitle>
        <DialogContent>{confirmDepartment?.departmentName} will be permanently removed. Active employees must be moved or deactivated first.</DialogContent>
        <DialogActions><Button onClick={() => setConfirmDepartment(null)}>Cancel</Button><Button color="error" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(confirmDepartment.id)}>Delete</Button></DialogActions>
      </Dialog>
      <Snackbar open={notice.open} autoHideDuration={5000} onClose={() => setNotice((current) => ({ ...current, open: false }))}>
        <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>
      </Snackbar>
    </Box>
  );
}
