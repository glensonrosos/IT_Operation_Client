import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add, ArchiveOutlined, Download, EditOutlined, RestoreOutlined, UploadFile, VisibilityOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { can } from '../../utils/permissions.js';
import EmployeeFormDialog from './EmployeeFormDialog.jsx';
import * as XLSX from 'xlsx';

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

export default function EmployeesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('fullName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [confirmEmployee, setConfirmEmployee] = useState(null);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const [fileOperation, setFileOperation] = useState('');
  const [importReport, setImportReport] = useState(null);
  const importInputRef = useRef(null);
  const searchTerm = useDebouncedValue(search);
  const canArchive = can(user, 'employees.archive');
  const departmentsQuery = useQuery({
    queryKey: ['departments', { page: 1, limit: 100 }],
    queryFn: async () => (await apiClient.get('/departments', { params: { limit: 100 } })).data.data.items
  });
  const params = {
    page: page + 1, limit: rowsPerPage, search: searchTerm || undefined, department: department || undefined,
    status: status || undefined, includeArchived: includeArchived && canArchive ? 'true' : 'false', sortBy, sortOrder
  };
  const employeesQuery = useQuery({
    queryKey: ['employees', params],
    queryFn: async () => (await apiClient.get('/employees', { params })).data.data
  });
  const saveMutation = useMutation({
    mutationFn: async ({ id, values }) => id
      ? apiClient.patch(`/employees/${id}`, Object.fromEntries(Object.entries(values).filter(([key]) => key !== 'employeeId')))
      : apiClient.post('/employees', values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setDialogOpen(false);
      setEditingEmployee(null);
      setNotice({ open: true, message: editingEmployee ? 'Employee record updated.' : 'Employee record created.', severity: 'success' });
    }
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, restore }) => apiClient.post(`/employees/${id}/${restore ? 'restore' : 'archive'}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setConfirmEmployee(null);
      setNotice({ open: true, message: variables.restore ? 'Employee record restored.' : 'Employee record archived.', severity: 'success' });
    }
  });

  const handleSort = (field) => {
    setSortOrder(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc');
    setSortBy(field);
    setPage(0);
  };
  const submitForm = async (values) => {
    try {
      await saveMutation.mutateAsync({ id: editingEmployee?.id, values });
    } catch (error) {
      setNotice({ open: true, message: errorMessage(error), severity: 'error' });
    }
  };
  const exportEmployees = async () => {
    setFileOperation('export');
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const exportRows = rows.map((employee) => ({
        'Employee ID': employee.employeeId,
        'First Name': employee.firstName,
        'Last Name': employee.lastName,
        Department: employee.department?.departmentName ?? '',
        Position: employee.position ?? '',
        Email: employee.email ?? '',
        'Contact Number': employee.contactNumber ?? '',
        Location: employee.location ?? '',
        Status: employee.status
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');
      XLSX.writeFile(workbook, `employees-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } finally {
      setFileOperation('');
    }
  };
  const importEmployees = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setNotice({ open: true, message: 'Please select an .xlsx file.', severity: 'error' });
      return;
    }
    setFileOperation('import');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const importedRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const normalize = (key) => String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
      const departments = departmentsQuery.data ?? [];
      const seen = new Set();
      const failures = [];
      let created = 0;
      for (let index = 0; index < importedRows.length; index += 1) {
        const source = importedRows[index];
        const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [normalize(key), String(value).trim()]));
        const firstName = row.firstname;
        const lastName = row.lastname;
        const departmentValue = row.department || row.departmentcode;
        const departmentRecord = departments.find((item) => [item.id, item.departmentCode, item.departmentName].some((value) => String(value ?? '').toLowerCase() === String(departmentValue ?? '').toLowerCase()));
        const nameKey = `${firstName} ${lastName}`.toLowerCase();
        const errors = [];
        if (!firstName) errors.push('First Name is required');
        if (!lastName) errors.push('Last Name is required');
        if (!departmentRecord) errors.push('Department must match an active department name or code');
        if (seen.has(nameKey)) errors.push('Duplicate name in import file');
        if (errors.length) {
          failures.push(`Row ${index + 2}: ${errors.join(', ')}`);
          continue;
        }
        seen.add(nameKey);
        try {
          const existing = (await apiClient.get('/employees', {
            params: { search: `${firstName} ${lastName}`, includeArchived: 'true', limit: 100 }
          })).data.data.items ?? [];
          if (existing.some((employee) => employee.fullName?.trim().toLowerCase() === nameKey)) {
            failures.push(`Row ${index + 2}: An employee with this name already exists`);
            continue;
          }
          await apiClient.post('/employees', {
            firstName,
            lastName,
            department: departmentRecord.id,
            position: row.position || undefined,
            email: row.email || undefined,
            contactNumber: row.contactnumber || undefined,
            location: row.location || undefined,
            notes: row.notes || undefined,
            status: row.status || 'ACTIVE'
          });
          created += 1;
        } catch (error) {
          failures.push(`Row ${index + 2}: ${errorMessage(error)}`);
        }
      }
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      setImportReport({ created, failures });
      setNotice({ open: true, message: `Import finished: ${created} created${failures.length ? `, ${failures.length} rejected` : ''}.${failures.length ? ` ${failures.slice(0, 3).join(' | ')}` : ''}`, severity: failures.length ? 'warning' : 'success' });
    } catch {
      setNotice({ open: true, message: 'Unable to read the .xlsx file. Check that it contains a valid first worksheet.', severity: 'error' });
    } finally {
      setFileOperation('');
    }
  };
  const rows = employeesQuery.data?.items ?? [];
  const pagination = employeesQuery.data?.pagination;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={700}>People</Typography>
              <Typography variant="h4" component="h1" fontWeight={700}>Employees</Typography>
              <Typography color="text.secondary">Employee records for IT support and accountability. Employees do not sign in.</Typography>
            </Box>
            {can(user, 'employees.create') && <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
              <Button variant="outlined" startIcon={fileOperation === 'export' ? <CircularProgress size={18} /> : <Download />} onClick={exportEmployees} disabled={Boolean(fileOperation)}>{fileOperation === 'export' ? 'Exporting…' : 'Export .xlsx'}</Button>
              <Button variant="outlined" component="label" startIcon={fileOperation === 'import' ? <CircularProgress size={18} /> : <UploadFile />} disabled={Boolean(fileOperation)}>{fileOperation === 'import' ? 'Importing…' : 'Import .xlsx'}<input ref={importInputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importEmployees} /></Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingEmployee(null); setDialogOpen(true); }}>Add employee</Button>
            </Stack>}
          </Stack>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <TextField label="Search name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} size="small" sx={{ minWidth: 260, flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel id="employee-department-filter-label">Department</InputLabel>
                <Select labelId="employee-department-filter-label" label="Department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(0); }}>
                  <MenuItem value="">All departments</MenuItem>
                  {(departmentsQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.departmentName}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel id="employee-status-filter-label">Employment status</InputLabel>
                <Select labelId="employee-status-filter-label" label="Employment status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}>
                  <MenuItem value="">All statuses</MenuItem>
                  {['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED', 'RETIRED'].map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>
              {canArchive && <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="employee-archive-filter-label">Records</InputLabel>
                <Select labelId="employee-archive-filter-label" label="Records" value={includeArchived ? 'all' : 'current'} onChange={(event) => { setIncludeArchived(event.target.value === 'all'); setPage(0); }}>
                  <MenuItem value="current">Current only</MenuItem><MenuItem value="all">Include archived</MenuItem>
                </Select>
              </FormControl>}
            </Stack>
          </Paper>
          {employeesQuery.isError && <Alert severity="error">{errorMessage(employeesQuery.error)}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Table size="small">
              <TableHead><TableRow>
                <TableCell><TableSortLabel active={sortBy === 'fullName'} direction={sortBy === 'fullName' ? sortOrder : 'asc'} onClick={() => handleSort('fullName')}>Employee</TableSortLabel></TableCell>
                <TableCell>Department</TableCell><TableCell>Position</TableCell>
                <TableCell><TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortOrder : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel></TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow></TableHead>
              <TableBody>
                {employeesQuery.isPending ? <TableRow><TableCell colSpan={5} align="center"><CircularProgress size={24} sx={{ my: 3 }} /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={5} align="center" sx={{ py: 5, color: 'text.secondary' }}>No employee records found.</TableCell></TableRow> : rows.map((employee) => (
                  <TableRow hover key={employee.id}>
                    <TableCell><Stack><Typography fontWeight={600}>{employee.fullName}</Typography><Typography variant="body2" color="text.secondary">{employee.email || 'No email recorded'}</Typography></Stack></TableCell>
                    
                    <TableCell>{employee.department?.departmentName ?? '—'}</TableCell>
                    <TableCell>{employee.position || '—'}</TableCell>
                    <TableCell><Chip size="small" label={employee.isArchived ? 'ARCHIVED' : employee.status.replaceAll('_', ' ')} color={employee.isArchived ? 'default' : employee.status === 'ACTIVE' ? 'success' : 'warning'} /></TableCell>
                    <TableCell align="right"><Stack direction="row" justifyContent="flex-end">
                      <Button size="small" startIcon={<VisibilityOutlined />} onClick={() => navigate(`/employees/${employee.id}`)}>View</Button>
                      {!employee.isArchived && can(user, 'employees.update') && <Button size="small" startIcon={<EditOutlined />} onClick={() => { setEditingEmployee(employee); setDialogOpen(true); }}>Edit</Button>}
                      {canArchive && (employee.isArchived
                        ? <Button size="small" startIcon={<RestoreOutlined />} onClick={() => archiveMutation.mutate({ id: employee.id, restore: true })}>Restore</Button>
                        : employee.status !== 'ACTIVE' && <Button size="small" color="warning" startIcon={<ArchiveOutlined />} onClick={() => setConfirmEmployee(employee)}>Archive</Button>)}
                    </Stack></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination component="div" count={pagination?.total ?? 0} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} />
          </TableContainer>
        </Stack>
      </Container>
      <EmployeeFormDialog open={dialogOpen} employee={editingEmployee} departments={departmentsQuery.data ?? []} saving={saveMutation.isPending} onClose={() => setDialogOpen(false)} onSubmit={submitForm} />
      <Dialog open={Boolean(importReport)} onClose={() => setImportReport(null)} fullWidth maxWidth="md">
        <DialogTitle>Employee import results</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Typography>Created: <strong>{importReport?.created ?? 0}</strong> · Rejected: <strong>{importReport?.failures?.length ?? 0}</strong></Typography>
            {importReport?.failures?.length > 0 ? <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 360, overflow: 'auto' }}><Stack spacing={1}>{importReport.failures.map((failure) => <Typography key={failure} variant="body2" color="error.main">{failure}</Typography>)}</Stack></Paper> : <Alert severity="success">All rows were imported successfully.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setImportReport(null)}>Close</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(confirmEmployee)} onClose={() => setConfirmEmployee(null)}>
        <DialogTitle>Archive employee record?</DialogTitle>
        <DialogContent>{confirmEmployee?.fullName} will be hidden from normal directory results. Historical references will remain.</DialogContent>
        <DialogActions><Button onClick={() => setConfirmEmployee(null)}>Cancel</Button><Button color="warning" onClick={() => archiveMutation.mutate({ id: confirmEmployee.id, restore: false })}>Archive</Button></DialogActions>
      </Dialog>
      <Snackbar open={notice.open} autoHideDuration={5000} onClose={() => setNotice((current) => ({ ...current, open: false }))}>
        <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>
      </Snackbar>
    </Box>
  );
}
