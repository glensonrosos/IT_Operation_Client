import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditOutlined, PersonAddAlt1 } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import AssetFormDialog from './AssetFormDialog.jsx';
import AssetAssignmentDialog from './AssetAssignmentDialog.jsx';
import AssetTransferPanel from './AssetTransferPanel.jsx';
import AssetReturnPanel from './AssetReturnPanel.jsx';
import AssetMaintenancePanel from './AssetMaintenancePanel.jsx';

const tabs = ['Overview', 'Current Custodian', 'Transfers', 'Returns', 'Borrowing', 'History', 'Maintenance', 'Tickets', 'Warranty', 'Asset images', 'Parts Issued'];

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function assetAge(purchaseDate) {
  if (!purchaseDate) return '—';
  const start = new Date(purchaseDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return `${years} year${years === 1 ? '' : 's'}, ${months} month${months === 1 ? '' : 's'}`;
}

function groupImagesByDate(images) {
  return Object.entries(images.reduce((groups, image) => {
    const date = image.createdAt ? new Date(image.createdAt).toLocaleDateString() : 'Unknown date';
    const key = `${date}|${image.transferFrom ?? ''}|${image.transferTo ?? ''}|${image.returnBy ?? ''}|${image.uploadedVia ?? ''}`;
    (groups[key] ??= []).push(image);
    return groups;
  }, {}));
}

export default function AssetDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(() => searchParams.get('tab') === 'maintenance' || searchParams.get('tab') === '6' ? 6 : searchParams.get('tab') === 'parts-issued' || searchParams.get('tab') === '10' ? 10 : 0);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const [previewImage, setPreviewImage] = useState(null);
  const [contentPage, setContentPage] = useState(0);
  const [contentRowsPerPage, setContentRowsPerPage] = useState(5);
  const [imagePage, setImagePage] = useState(0);
  const [imageRowsPerPage, setImageRowsPerPage] = useState(3);
  const [assignmentPage, setAssignmentPage] = useState(0);
  const [assignmentRowsPerPage, setAssignmentRowsPerPage] = useState(10);
  const assetQuery = useQuery({ queryKey: ['asset', id], queryFn: async () => (await apiClient.get(`/assets/${id}`)).data.data.asset });
  const asset = assetQuery.data;
  const sparePartsQuery = useQuery({ queryKey: ['asset-spare-parts', id], enabled: Boolean(asset) && tab === 10, queryFn: async () => (await apiClient.get(`/assets/${id}/spare-parts`)).data.data.items });
  const currentAssignmentQuery = useQuery({ queryKey: ['asset-current-assignment', id], enabled: Boolean(asset), queryFn: async () => (await apiClient.get(`/assets/${id}/current-assignment`)).data.data.assignment });
  const assignmentsQuery = useQuery({ queryKey: ['asset-assignments', id], enabled: Boolean(asset) && tab === 1, queryFn: async () => (await apiClient.get(`/assets/${id}/assignments`)).data.data.items });
  const historyQuery = useQuery({ queryKey: ['asset-history', id], enabled: Boolean(asset) && tab === 5, queryFn: async () => (await apiClient.get(`/assets/${id}/history`)).data.data.items });
  const imagesQuery = useQuery({ queryKey: ['asset-images', id], enabled: Boolean(asset) && tab === 9, queryFn: async () => (await apiClient.get(`/assets/${id}/images`)).data.data.images });
  const ticketsQuery = useQuery({ queryKey: ['asset-tickets', id], enabled: Boolean(asset) && tab === 7 && (can(user, 'tickets.view') || can(user, 'tickets.view.assigned')), queryFn: async () => (await apiClient.get('/tickets', { params: { asset: asset._id, limit: 50 } })).data.data.items });
  const canReadBorrowings = can(user, 'borrowing.view') || can(user, 'borrowing.view.assigned');
  const borrowingsQuery = useQuery({ queryKey: ['asset-borrowings', id], enabled: Boolean(asset) && tab === 4 && canReadBorrowings, queryFn: async () => (await apiClient.get('/borrowings', { params: { asset: asset._id, limit: 50 } })).data.data.items });
  const departmentsQuery = useQuery({ queryKey: ['departments', { limit: 100 }], enabled: editOpen, queryFn: async () => (await apiClient.get('/departments', { params: { limit: 100 } })).data.data.items });
  const typesQuery = useQuery({ queryKey: ['asset-types-active'], enabled: editOpen, queryFn: async () => (await apiClient.get('/asset-types')).data.data.items });
  const updateMutation = useMutation({
    mutationFn: async (values) => {
      const images = values.images ?? [];
      const body = Object.fromEntries(Object.entries(values).filter(([key]) => !['assetType', 'images', 'assignTo', 'accessories'].includes(key)));
      if (Object.keys(body).length) {
        try {
          await apiClient.patch(`/assets/${id}`, body);
        } catch (error) {
          const code = error?.response?.data?.code;
          if (!(images.length && code === 'NO_CHANGES')) throw error;
        }
      }
      if (images.length) {
        const formData = new FormData();
        images.forEach((image) => formData.append('images', image));
        formData.append('uploadedVia', 'Edit Asset');
        await apiClient.post(`/assets/${id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['asset'] }); await queryClient.invalidateQueries({ queryKey: ['asset-images', id] }); await queryClient.invalidateQueries({ queryKey: ['assets'] }); setEditOpen(false); setNotice({ open: true, message: 'Asset updated.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const assignmentMutation = useMutation({
    mutationFn: (values) => apiClient.post(`/assets/${id}/assign`, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['asset'] }),
        queryClient.invalidateQueries({ queryKey: ['assets'] }),
        queryClient.invalidateQueries({ queryKey: ['asset-current-assignment', id] }),
        queryClient.invalidateQueries({ queryKey: ['asset-assignments', id] }),
        queryClient.invalidateQueries({ queryKey: ['asset-history', id] })
      ]);
      setAssignOpen(false);
      setNotice({ open: true, message: 'Asset assigned.', severity: 'success' });
    },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });

  if (assetQuery.isPending) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!asset) return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}><DirectoryNavigation /><Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">Asset details are unavailable.</Alert></Container></Box>;
  if (assetQuery.isError) return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}><DirectoryNavigation /><Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">{errorMessage(assetQuery.error)}</Alert></Container></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={2}>
              <Box sx={{ flex: 1 }}><Typography variant="overline" color="primary.main" fontWeight={700}>{asset.assetId}</Typography><Typography variant="h4" component="h1" fontWeight={700}>{asset.assetName}</Typography><Typography color="text.secondary">{asset.assetType?.name ?? asset.assetTypeCode} · {asset.brand} {asset.model}</Typography></Box>
              <Chip label={(asset.status ?? 'UNKNOWN').replaceAll('_', ' ')} color={asset.status === 'AVAILABLE' || asset.status === 'IN_STOCK' ? 'success' : ['DAMAGED', 'LOST', 'DISPOSED'].includes(asset.status) ? 'error' : 'default'} />
              <Chip label={asset.condition} variant="outlined" />
              {can(user, 'assets.update') && !asset.isArchived && <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditOpen(true)}>Edit</Button>}
              {can(user, 'assets.assign') && !asset.isArchived && !asset.currentCustodian && ['AVAILABLE', 'IN_STOCK'].includes(asset.status) && <Button variant="contained" startIcon={<PersonAddAlt1 />} onClick={() => setAssignOpen(true)}>Assign asset</Button>}
            </Stack>
          </Paper>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">{tabs.map((label) => <Tab key={label} label={label} />)}</Tabs>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {tab === 0 && <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
                <Paper variant="outlined" sx={{ p: 2.5, flex: 2 }}><Typography variant="h6" fontWeight={700} gutterBottom>Asset information</Typography><Stack spacing={1.2}><Typography><strong>Type:</strong> {asset.assetType?.name ?? asset.assetTypeCode}</Typography><Typography><strong>Serial number:</strong> {asset.serialNumber || '—'}</Typography><Typography><strong>Department:</strong> {asset.department?.departmentName ?? '—'}</Typography><Typography><strong>Location:</strong> {asset.location || '—'}</Typography><Typography sx={{ whiteSpace: 'pre-line' }}><strong>Description:</strong>{'\n'}<Box component="span" sx={{ whiteSpace: 'pre-line' }}>{asset.description || '—'}</Box></Typography></Stack></Paper>
                <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}><Typography variant="h6" fontWeight={700} gutterBottom>Accountability</Typography><Typography><strong>Current custodian:</strong> {asset.currentCustodian?.fullName ?? 'Unassigned'}</Typography><Typography><strong>Current borrower:</strong> {asset.currentBorrower?.fullName ?? '—'}</Typography><Typography><strong>Borrowable:</strong> {asset.isBorrowable ? 'Yes' : 'No'}</Typography><Typography sx={{ mt: 1 }}><strong>Purchase date:</strong> {asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : '—'}</Typography><Typography><strong>Purchase cost:</strong> {asset.purchaseCost ?? '—'}</Typography><Typography sx={{ mt: 1 }}><strong>Warranty:</strong> {asset.warrantyEnd ? `Until ${new Date(asset.warrantyEnd).toLocaleDateString()}` : 'Not recorded'}</Typography></Paper>
              </Stack>}
              {tab === 1 && <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6" fontWeight={700} gutterBottom>Current custodian</Typography>{currentAssignmentQuery.isPending ? <CircularProgress size={24} /> : currentAssignmentQuery.data ? <Stack spacing={1}><Typography><strong>Employee:</strong> {currentAssignmentQuery.data.employee?.fullName}</Typography><Typography><strong>Department:</strong> {currentAssignmentQuery.data.department?.departmentName ?? '—'}</Typography><Typography><strong>Assigned on:</strong> {formatDate(currentAssignmentQuery.data.assignedAt)}</Typography><Typography><strong>Condition at assignment:</strong> {currentAssignmentQuery.data.condition}</Typography><Typography><strong>Accessories:</strong> {currentAssignmentQuery.data.accessories?.join(', ') || '—'}</Typography></Stack> : <Typography color="text.secondary">This asset has no active custodian.</Typography>}</Paper>}
              {tab === 1 && <Stack spacing={2}><Typography variant="h6" fontWeight={700}>Assignment history</Typography>{assignmentsQuery.isPending ? <CircularProgress size={24} /> : (assignmentsQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No assignment records yet.</Typography> : <><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Department</TableCell><TableCell>Assigned</TableCell><TableCell>Returned</TableCell><TableCell>Status</TableCell><TableCell>Condition</TableCell></TableRow></TableHead><TableBody>{assignmentsQuery.data.slice(assignmentPage * assignmentRowsPerPage, assignmentPage * assignmentRowsPerPage + assignmentRowsPerPage).map((record) => <TableRow key={record._id}><TableCell>{record.employee?.fullName}</TableCell><TableCell>{record.department?.departmentName}</TableCell><TableCell>{formatDate(record.assignedAt)}</TableCell><TableCell>{formatDate(record.returnedAt)}</TableCell><TableCell>{record.isActive ? 'ACTIVE' : 'CLOSED'}</TableCell><TableCell>{record.condition}</TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={assignmentsQuery.data.length} page={assignmentPage} onPageChange={(_, page) => setAssignmentPage(page)} rowsPerPage={assignmentRowsPerPage} onRowsPerPageChange={(event) => { setAssignmentRowsPerPage(Number(event.target.value)); setAssignmentPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></>}</Stack>}
              {tab === 2 && <AssetTransferPanel asset={asset} />}
              {tab === 3 && <AssetReturnPanel asset={asset} />}
              {tab === 4 && (!canReadBorrowings ? <Alert severity="info">Your IT role cannot view borrowings.</Alert> : borrowingsQuery.isPending ? <CircularProgress size={24} /> : borrowingsQuery.isError ? <Alert severity="error">{errorMessage(borrowingsQuery.error)}</Alert> : (borrowingsQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No borrowing history for this asset.</Typography> : <Stack spacing={1.5}>{borrowingsQuery.data.slice(contentPage * contentRowsPerPage, contentPage * contentRowsPerPage + contentRowsPerPage).map((borrowing) => <Paper variant="outlined" key={borrowing.id} sx={{ p: 1.5 }}><Button component={Link} to={`/borrowings/${borrowing.id}`}>{borrowing.borrowingNumber} · {borrowing.borrowerSnapshot?.fullName}</Button><Typography variant="body2" color="text.secondary">{borrowing.status} · Due {new Date(borrowing.dueAt).toLocaleString()}</Typography></Paper>)}<TablePagination component="div" count={(borrowingsQuery.data ?? []).length} page={contentPage} onPageChange={(_, nextPage) => setContentPage(nextPage)} rowsPerPage={contentRowsPerPage} onRowsPerPageChange={(event) => { setContentRowsPerPage(Number(event.target.value)); setContentPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></Stack>)}
              {tab === 5 && <Stack spacing={1.5}>{historyQuery.isPending ? <CircularProgress size={24} /> : (historyQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No asset history.</Typography> : historyQuery.data.slice(contentPage * contentRowsPerPage, contentPage * contentRowsPerPage + contentRowsPerPage).map((entry) => <Paper variant="outlined" key={entry._id} sx={{ p: 2 }}><Typography fontWeight={700}>{entry.description}</Typography><Typography variant="body2" color="text.secondary">{entry.action} · {entry.actor?.firstName} {entry.actor?.lastName} · {formatDate(entry.createdAt)}</Typography></Paper>)}<TablePagination component="div" count={(historyQuery.data ?? []).length} page={contentPage} onPageChange={(_, nextPage) => setContentPage(nextPage)} rowsPerPage={contentRowsPerPage} onRowsPerPageChange={(event) => { setContentRowsPerPage(Number(event.target.value)); setContentPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></Stack>}
              {tab === 6 && <AssetMaintenancePanel asset={asset} />}
              {tab === 7 && <Stack spacing={1.5}>{!can(user, 'tickets.view') && !can(user, 'tickets.view.assigned') ? <Alert severity="info">Your IT role cannot view tickets.</Alert> : ticketsQuery.isPending ? <CircularProgress size={24} /> : (ticketsQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No related tickets.</Typography> : ticketsQuery.data.slice(contentPage * contentRowsPerPage, contentPage * contentRowsPerPage + contentRowsPerPage).map((ticket) => <Paper variant="outlined" key={ticket.id} sx={{ p: 1.5 }}><Button component={Link} to={`/tickets/${ticket.id}`}>{ticket.ticketNumber} · {ticket.title}</Button><Typography variant="body2" color="text.secondary">{ticket.status} · {ticket.priority}</Typography></Paper>)}<TablePagination component="div" count={(ticketsQuery.data ?? []).length} page={contentPage} onPageChange={(_, nextPage) => setContentPage(nextPage)} rowsPerPage={contentRowsPerPage} onRowsPerPageChange={(event) => { setContentRowsPerPage(Number(event.target.value)); setContentPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></Stack>}
              {tab === 8 && <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6" fontWeight={700} gutterBottom>Warranty</Typography><Typography><strong>Vendor:</strong> {asset.vendor || '—'}</Typography><Typography><strong>Coverage period:</strong> {asset.warrantyStart ? new Date(asset.warrantyStart).toLocaleDateString() : '—'} to {asset.warrantyEnd ? new Date(asset.warrantyEnd).toLocaleDateString() : '—'}</Typography><Typography><strong>Asset age:</strong> {assetAge(asset.purchaseDate)}</Typography><Typography><strong>Invoice:</strong> {asset.invoiceNumber || '—'}</Typography></Paper>}
              {tab === 10 && <Stack spacing={2}><Typography variant="h6" fontWeight={700}>Parts Issued</Typography>{sparePartsQuery.isPending ? <CircularProgress size={24} /> : (sparePartsQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No spare parts have been issued to this asset.</Typography> : <><Table size="small"><TableHead><TableRow><TableCell>Part number</TableCell><TableCell>Part</TableCell><TableCell>Quantity</TableCell><TableCell>Issued</TableCell><TableCell>Reason</TableCell></TableRow></TableHead><TableBody>{sparePartsQuery.data.slice(contentPage * contentRowsPerPage, contentPage * contentRowsPerPage + contentRowsPerPage).map((movement) => <TableRow key={movement._id}><TableCell>{movement.sparePart?.partNumber}</TableCell><TableCell>{[movement.sparePart?.partType, movement.sparePart?.manufacturer, movement.sparePart?.model].filter(Boolean).join(' - ') || '�'}</TableCell><TableCell>{movement.quantity}</TableCell><TableCell>{formatDate(movement.createdAt)}</TableCell><TableCell>{movement.reason}</TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={(sparePartsQuery.data ?? []).length} page={contentPage} onPageChange={(_, nextPage) => setContentPage(nextPage)} rowsPerPage={contentRowsPerPage} onRowsPerPageChange={(event) => { setContentRowsPerPage(Number(event.target.value)); setContentPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></>}</Stack>}
              {tab === 9 && <Stack spacing={2}><Typography variant="h6" fontWeight={700}>Asset images</Typography>{imagesQuery.isPending ? <CircularProgress size={24} /> : imagesQuery.isError ? <Alert severity="error">Unable to load asset images.</Alert> : (imagesQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No images attached to this asset.</Typography> : <><Stack spacing={3}>{groupImagesByDate(imagesQuery.data).slice(imagePage * imageRowsPerPage, imagePage * imageRowsPerPage + imageRowsPerPage).map(([groupKey, images]) => { const [date, transferFrom, transferTo, returnBy, uploadedVia] = groupKey.split('|'); return <Box key={groupKey}><Typography variant="subtitle1" fontWeight={700} gutterBottom>Uploaded {date}{uploadedVia ? <> — via {uploadedVia}</> : returnBy ? <> — Returned by <Box component="span" sx={{ color: 'error.main' }}>{returnBy}</Box></> : transferFrom && transferTo ? <> — Transfer from <Box component="span" sx={{ color: 'error.main' }}>{transferFrom}</Box> to <Box component="span" sx={{ color: 'error.main' }}>{transferTo}</Box></> : ''}</Typography><Stack direction="row" spacing={2} flexWrap="wrap">{images.map((image) => <Paper variant="outlined" key={image._id ?? image.id} sx={{ p: 1, width: 220 }}><Box component="img" src={`/api/assets/${id}/images/${image._id ?? image.id}`} alt={image.originalName} onDoubleClick={() => setPreviewImage({ url: `/api/assets/${id}/images/${image._id ?? image.id}`, name: image.originalName })} sx={{ width: '100%', height: 150, objectFit: 'contain', bgcolor: 'grey.100', borderRadius: 1, cursor: 'zoom-in' }} /><Typography variant="body2" noWrap sx={{ mt: 1 }}>{image.originalName}</Typography><Button component="a" href={`/api/assets/${id}/images/${image._id ?? image.id}`} download={image.originalName} size="small">Download</Button></Paper>)}</Stack></Box>; })}</Stack><TablePagination component="div" count={groupImagesByDate(imagesQuery.data).length} page={imagePage} onPageChange={(_, nextPage) => setImagePage(nextPage)} rowsPerPage={imageRowsPerPage} onRowsPerPageChange={(event) => { setImageRowsPerPage(Number(event.target.value)); setImagePage(0); }} rowsPerPageOptions={[3, 5, 10]} /></>}</Stack>}
            </Box>
          </Paper>
        </Stack>
      </Container>
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} fullWidth maxWidth="lg"><DialogTitle>{previewImage?.name}</DialogTitle><DialogContent><Box component="img" src={previewImage?.url} alt={previewImage?.name ?? 'Asset image'} sx={{ display: 'block', width: '100%', maxHeight: '75vh', objectFit: 'contain' }} /></DialogContent><DialogActions><Button onClick={() => setPreviewImage(null)}>Close</Button></DialogActions></Dialog>
      <AssetFormDialog open={editOpen} asset={asset} types={typesQuery.data ?? []} departments={departmentsQuery.data ?? []} saving={updateMutation.isPending} error={updateMutation.error ? errorMessage(updateMutation.error) : ''} onClose={() => setEditOpen(false)} onSubmit={(values) => updateMutation.mutate(values)} />
      <AssetAssignmentDialog open={assignOpen} asset={asset} saving={assignmentMutation.isPending} error={assignmentMutation.error ? errorMessage(assignmentMutation.error) : ''} onClose={() => setAssignOpen(false)} onSubmit={(values) => assignmentMutation.mutate(values)} />
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>}
    </Box>
  );
}
