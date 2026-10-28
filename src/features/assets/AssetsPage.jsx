import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add, ArchiveOutlined, EditOutlined, PersonAddAlt1, RestoreOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Checkbox, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Popper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Tooltip, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';
import { can } from '../../utils/permissions.js';
import AssetFormDialog from './AssetFormDialog.jsx';
import AssetAssignmentDialog from './AssetAssignmentDialog.jsx';

const statuses = ['AVAILABLE', 'ASSIGNED', 'BORROWED', 'UNDER_REPAIR', 'LOST', 'DAMAGED', 'RETIRED', 'DISPOSED'];
const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];

function errorMessage(error) {
  const issues = error?.response?.data?.errors;
  if (issues?.length) return `${error?.response?.data?.message ?? 'Validation failed'}: ${issues.map((issue) => `${issue.path?.join('.') || 'field'} - ${issue.message}`).join('; ')}`;
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

function statusColor(status) {
  if (status === 'LOST' || status === 'DAMAGED' || status === 'DISPOSED') return 'error';
  if (status === 'UNDER_REPAIR' || status === 'RETIRED') return 'warning';
  if (status === 'AVAILABLE' || status === 'IN_STOCK') return 'success';
  return 'default';
}

function canArchiveAsset(asset) {
  return ['LOST', 'RETIRED', 'DISPOSED'].includes(asset.status) && !asset.currentCustodian && !asset.currentBorrower && !asset.currentBorrowing && !asset.currentMaintenance && !asset.pendingTransfer && !asset.pendingReturn;
}

function AssetIdPreview({ asset, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const imageQuery = useQuery({
    queryKey: ['asset-images', asset.id],
    enabled: hovered,
    queryFn: async () => (await apiClient.get(`/assets/${asset.id}/images`)).data.data.images
  });
  const image = imageQuery.data?.[0];

  return (
    <>
      <Button size="small" onClick={onClick} onMouseEnter={(event) => { setHovered(true); setAnchorEl(event.currentTarget); }} onMouseLeave={() => { setHovered(false); setAnchorEl(null); }}>
        {asset.assetId}
      </Button>
      {image && <Popper open={hovered} anchorEl={anchorEl} placement="right-start" sx={{ zIndex: 1500, pointerEvents: 'none' }}>
        <Box sx={{ p: 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, boxShadow: 6 }}>
          <Box component="img" src={`/api/assets/${asset.id}/images/${image._id ?? image.id}`} alt={`${asset.assetId} preview`} sx={{ display: 'block', width: 420, height: 420, objectFit: 'contain', bgcolor: 'grey.100', borderRadius: 1 }} />
        </Box>
      </Popper>}
    </>
  );
}

export default function AssetsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [assetType, setAssetType] = useState('');
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [department, setDepartment] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sortBy, setSortBy] = useState('assetId');
  const [sortOrder, setSortOrder] = useState('asc');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [assignAsset, setAssignAsset] = useState(null);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const searchTerm = useDebouncedValue(search);
  const canArchive = can(user, 'assets.archive');
  const typesQuery = useQuery({ queryKey: ['asset-types-active'], queryFn: async () => (await apiClient.get('/asset-types')).data.data.items });
  const employeesQuery = useQuery({ queryKey: ['employees-asset-assignment'], enabled: formOpen, queryFn: async () => (await apiClient.get('/employees', { params: { limit: 100 } })).data.data.items });
  const departmentsQuery = useQuery({ queryKey: ['departments', { page: 1, limit: 100 }], queryFn: async () => (await apiClient.get('/departments', { params: { limit: 100 } })).data.data.items });
  const params = {
    page: page + 1, limit: rowsPerPage, search: searchTerm || undefined, assetType: assetType || undefined,
    status: status || undefined, condition: condition || undefined, department: department || undefined,
    unassigned: unassigned ? 'true' : undefined, includeArchived: includeArchived && canArchive ? 'true' : 'false', sortBy, sortOrder
  };
  const assetsQuery = useQuery({ queryKey: ['assets', params], queryFn: async () => (await apiClient.get('/assets', { params })).data.data });
  const saveMutation = useMutation({
    mutationFn: async ({ id, values }) => {
      const images = values.images ?? [];
      const assignTo = values.assignTo;
      const accessories = values.accessories;
      const body = Object.fromEntries(Object.entries(values).filter(([key]) => !['images', 'assignTo', 'accessories'].includes(key) && (!id || key !== 'assetType')));
      const response = id
        ? (Object.keys(body).length ? await apiClient.patch(`/assets/${id}`, body) : { data: { data: { asset: { id } } } })
        : await apiClient.post('/assets', body);
      if (assignTo && (!id || !editingAsset?.currentCustodian)) await apiClient.post(`/assets/${response.data.data.asset.id ?? id}/assign`, { employee: assignTo, location: values.location || '', condition: values.condition || 'GOOD', accessories: (accessories || '').split(',').map((item) => item.trim()).filter(Boolean), notes: values.notes || '' });
      if (images.length) {
        const formData = new FormData();
        images.forEach((image) => formData.append('images', image));
        await apiClient.post(`/assets/${response.data.data.asset?.id ?? id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return response;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['assets'] }); setFormOpen(false); setEditingAsset(null); setNotice({ open: true, message: editingAsset ? 'Asset updated.' : 'Asset registered.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const assignMutation = useMutation({
    mutationFn: ({ asset, values }) => apiClient.post(`/assets/${asset.id}/assign`, values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['assets'] }); setAssignAsset(null); setNotice({ open: true, message: 'Asset assigned and accountability record created.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const archiveMutation = useMutation({
    mutationFn: ({ asset, restore }) => apiClient.post(`/assets/${asset.id}/${restore ? 'restore' : 'archive'}`),
    onSuccess: async (_, variables) => { await queryClient.invalidateQueries({ queryKey: ['assets'] }); setConfirmArchive(null); setNotice({ open: true, message: variables.restore ? 'Asset restored.' : 'Asset archived.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const handleSort = (field) => { setSortOrder(sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc'); setSortBy(field); setPage(0); };
  const rows = assetsQuery.data?.items ?? [];
  const pagination = assetsQuery.data?.pagination;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box><Typography variant="overline" color="primary.main" fontWeight={700}>Asset Management</Typography><Typography variant="h4" component="h1" fontWeight={700}>Assets</Typography><Typography color="text.secondary">Track serialized company IT equipment, ownership, condition, and lifecycle.</Typography></Box>
            {can(user, 'assets.create') && <Button variant="contained" startIcon={<Add />} onClick={() => { setEditingAsset(null); setFormOpen(true); }}>Register asset</Button>}
          </Stack>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <TextField label="Search asset ID, serial, tag, or name" size="small" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} sx={{ minWidth: 250, flex: 1 }} />
              <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="asset-type-filter-label">Asset type</InputLabel><Select labelId="asset-type-filter-label" label="Asset type" value={assetType} onChange={(event) => { setAssetType(event.target.value); setPage(0); }}><MenuItem value="">All types</MenuItem>{(typesQuery.data ?? []).map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}</Select></FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="asset-status-filter-label">Status</InputLabel><Select labelId="asset-status-filter-label" label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }}><MenuItem value="">All statuses</MenuItem>{statuses.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>
              <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel id="asset-condition-filter-label">Condition</InputLabel><Select labelId="asset-condition-filter-label" label="Condition" value={condition} onChange={(event) => { setCondition(event.target.value); setPage(0); }}><MenuItem value="">All conditions</MenuItem>{conditions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <FormControl size="small" sx={{ minWidth: 210 }}><InputLabel id="asset-department-filter-label">Department</InputLabel><Select labelId="asset-department-filter-label" label="Department" value={department} onChange={(event) => { setDepartment(event.target.value); setPage(0); }}><MenuItem value="">All departments</MenuItem>{(departmentsQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.departmentName}</MenuItem>)}</Select></FormControl>
              <FormControlLabel control={<Checkbox checked={unassigned} onChange={(event) => { setUnassigned(event.target.checked); setPage(0); }} />} label={<Tooltip title="Assets without a custodian are treated as IT Department asset"><span>Without custodian</span></Tooltip>} />
              {canArchive && <FormControl size="small" sx={{ minWidth: 170 }}><InputLabel id="asset-records-filter-label">Records</InputLabel><Select labelId="asset-records-filter-label" label="Records" value={includeArchived ? 'all' : 'current'} onChange={(event) => { setIncludeArchived(event.target.value === 'all'); setPage(0); }}><MenuItem value="current">Current only</MenuItem><MenuItem value="all">Include archived</MenuItem></Select></FormControl>}
            </Stack>
          </Paper>
          {assetsQuery.isError && <Alert severity="error">{errorMessage(assetsQuery.error)}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Table size="small"><TableHead><TableRow>
              <TableCell><TableSortLabel active={sortBy === 'assetId'} direction={sortBy === 'assetId' ? sortOrder : 'asc'} onClick={() => handleSort('assetId')}>Asset ID</TableSortLabel></TableCell>
              <TableCell><TableSortLabel active={sortBy === 'assetName'} direction={sortBy === 'assetName' ? sortOrder : 'asc'} onClick={() => handleSort('assetName')}>Asset</TableSortLabel></TableCell>
              <TableCell>Serial / Service tag</TableCell><TableCell>Custodian / Borrower</TableCell><TableCell>Department</TableCell>
              <TableCell><TableSortLabel active={sortBy === 'status'} direction={sortBy === 'status' ? sortOrder : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel></TableCell>
              <TableCell>Condition</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow></TableHead><TableBody>
              {assetsQuery.isPending ? <TableRow><TableCell colSpan={8} align="center"><CircularProgress size={24} sx={{ my: 3 }} /></TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>No assets match these filters.</TableCell></TableRow> : rows.map((asset) => <TableRow hover key={asset.id}>
                <TableCell><AssetIdPreview asset={asset} onClick={() => navigate(`/assets/${asset.id}`)} /></TableCell>
                <TableCell><Stack><Typography fontWeight={600}>{asset.assetName}</Typography><Typography variant="body2" color="text.secondary">{asset.brand} {asset.model}</Typography></Stack></TableCell>
                <TableCell>{asset.serialNumber || asset.serviceTag || '—'}</TableCell>
                <TableCell>{asset.currentCustodian?.fullName ?? asset.currentBorrower?.fullName ?? '—'}</TableCell>
                <TableCell>{!asset.currentCustodian && !asset.currentBorrower && asset.status === 'AVAILABLE' ? 'IT' : (asset.department?.departmentName ?? '—')}</TableCell>
                <TableCell><Chip size="small" label={asset.isArchived ? 'ARCHIVED' : (asset.status ?? 'UNKNOWN').replaceAll('_', ' ')} color={asset.isArchived ? 'default' : statusColor(asset.status)} /></TableCell>
                <TableCell>{asset.condition}</TableCell>
                <TableCell align="right">{canArchive && (asset.isArchived ? <Button size="small" startIcon={<RestoreOutlined />} onClick={() => archiveMutation.mutate({ asset, restore: true })}>Restore</Button> : canArchiveAsset(asset) && <Button size="small" color="warning" startIcon={<ArchiveOutlined />} onClick={() => setConfirmArchive(asset)}>Archive</Button>)}</TableCell>

              </TableRow>)}
            </TableBody></Table>
            <TablePagination component="div" count={pagination?.total ?? 0} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} />
          </TableContainer>
        </Stack>
      </Container>
      <AssetFormDialog open={formOpen} asset={editingAsset} types={typesQuery.data ?? []} employees={employeesQuery.data ?? []} saving={saveMutation.isPending} error={saveMutation.error ? errorMessage(saveMutation.error) : ''} onClose={() => setFormOpen(false)} onSubmit={(values) => saveMutation.mutate({ id: editingAsset?.id, values })} />
      <AssetAssignmentDialog open={Boolean(assignAsset)} asset={assignAsset} saving={assignMutation.isPending} error={assignMutation.error ? errorMessage(assignMutation.error) : ''} onClose={() => setAssignAsset(null)} onSubmit={(values) => assignMutation.mutate({ asset: assignAsset, values })} />
      <Dialog open={Boolean(confirmArchive)} onClose={() => setConfirmArchive(null)}><DialogTitle>Archive asset?</DialogTitle><DialogContent>{confirmArchive?.assetId} will be hidden from normal inventory results. History remains available.</DialogContent><DialogActions><Button onClick={() => setConfirmArchive(null)}>Cancel</Button><Button color="warning" onClick={() => archiveMutation.mutate({ asset: confirmArchive, restore: false })}>Archive</Button></DialogActions></Dialog>
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>}
    </Box>
  );
}
