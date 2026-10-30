import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import AssetReturnDialog from './AssetReturnDialog.jsx';

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The return could not be recorded.';
}

export default function AssetReturnPanel({ asset }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const returnsQuery = useQuery({
    queryKey: ['asset-returns', asset.id],
    queryFn: async () => (await apiClient.get('/asset-returns', { params: { asset: asset._id, limit: 100 } })).data.data.items
  });
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['asset'] }),
    queryClient.invalidateQueries({ queryKey: ['assets'] }),
    queryClient.invalidateQueries({ queryKey: ['asset-current-assignment', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset-assignments', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset-history', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset-returns', asset.id] })
  ]);
  const onReturnSuccess = async (message) => {
    await refresh();
    setDialogOpen(false);
    setNotice({ open: true, message, severity: 'success' });
  };
  const returnMutation = useMutation({
    mutationFn: async (values) => {
      const { images, ...body } = values;
      const response = await apiClient.post(`/assets/${asset.id}/returns`, body);
      if (images?.length) {
        const formData = new FormData();
        images.forEach((image) => formData.append('images', image));
        formData.append('returnBy', asset.currentCustodian?.fullName ?? '');
        await apiClient.post(`/assets/${asset.id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return response;
    },
    onSuccess: () => onReturnSuccess('Asset return recorded and assignment closed.'),
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const resumeMutation = useMutation({
    mutationFn: () => apiClient.post(`/assets/${asset.id}/returns/resume`),
    onSuccess: () => onReturnSuccess('Pending return was reconciled.'),
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Box><Typography variant="h6" fontWeight={700}>Return history</Typography><Typography variant="body2" color="text.secondary">Record inspection, missing accessories, damage, and final condition.</Typography></Box>
        {can(user, 'assets.return') && asset.currentCustodian && !asset.pendingTransfer && !asset.pendingReturn && <Button variant="contained" onClick={() => setDialogOpen(true)}>Record return</Button>}
      </Stack>
      {asset.pendingTransfer && <Alert severity="info">Complete or cancel the pending transfer before returning this asset.</Alert>}
      {asset.pendingReturn && can(user, 'assets.return') && <Stack direction="row" alignItems="center" spacing={2}><Alert severity="warning" sx={{ flex: 1 }}>A return was interrupted and needs reconciliation.</Alert><Button variant="contained" disabled={resumeMutation.isPending} onClick={() => resumeMutation.mutate()}>{resumeMutation.isPending ? 'Resuming…' : 'Resume return'}</Button></Stack>}
      {returnsQuery.isError && <Alert severity="error">{errorMessage(returnsQuery.error)}</Alert>}
      {returnsQuery.isPending ? <Typography color="text.secondary">Loading return history…</Typography> : (returnsQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No return records.</Typography> : <><Table size="small"><TableHead><TableRow><TableCell>Return</TableCell><TableCell>Employee</TableCell><TableCell>Date</TableCell><TableCell>Result</TableCell><TableCell>Condition</TableCell><TableCell>Inspection</TableCell><TableCell>Missing accessories</TableCell></TableRow></TableHead><TableBody>{returnsQuery.data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((record) => <TableRow key={record.id}><TableCell><Button size="small" onClick={() => setSelectedReturn(record)}>{record.returnNumber}</Button></TableCell><TableCell>{record.employee?.fullName}</TableCell><TableCell>{new Date(record.returnDate).toLocaleString()}</TableCell><TableCell>{(record.result ?? 'UNKNOWN').replaceAll('_', ' ')}</TableCell><TableCell>{record.conditionAfter}</TableCell><TableCell>{(record.inspectionResult ?? 'UNKNOWN').replaceAll('_', ' ')}</TableCell><TableCell>{record.missingAccessories?.join(', ') || '—'}</TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={(returnsQuery.data ?? []).length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></>}
      <Dialog open={Boolean(selectedReturn)} onClose={() => setSelectedReturn(null)} fullWidth maxWidth="sm">
        <DialogTitle>Return {selectedReturn?.returnNumber}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography><strong>Employee:</strong> {selectedReturn?.employee?.fullName || '—'}</Typography>
            <Typography><strong>Return date:</strong> {selectedReturn?.returnDate ? new Date(selectedReturn.returnDate).toLocaleString() : '—'}</Typography>
            <Typography><strong>Result:</strong> {(selectedReturn?.result ?? 'UNKNOWN').replaceAll('_', ' ')}</Typography>
            <Typography><strong>Condition after:</strong> {selectedReturn?.conditionAfter || '—'}</Typography>
            <Typography><strong>Inspection:</strong> {(selectedReturn?.inspectionResult ?? 'UNKNOWN').replaceAll('_', ' ')}</Typography>
            <Typography><strong>Missing accessories:</strong> {selectedReturn?.missingAccessories?.join(', ') || '—'}</Typography>
            <Typography><strong>Damage or repair details:</strong> {selectedReturn?.damageDescription || '—'}</Typography>
            <Typography><strong>Return notes:</strong> {selectedReturn?.notes || '—'}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedReturn(null)}>Close</Button></DialogActions>
      </Dialog>
      <AssetReturnDialog open={dialogOpen} asset={asset} saving={returnMutation.isPending} error={returnMutation.error ? errorMessage(returnMutation.error) : ''} onClose={() => setDialogOpen(false)} onSubmit={(values) => returnMutation.mutate(values)} />
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>}
    </Stack>
  );
}
