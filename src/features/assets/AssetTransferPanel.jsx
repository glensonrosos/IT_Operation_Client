import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import AssetTransferDialog from './AssetTransferDialog.jsx';

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The transfer operation could not be completed.';
}

export default function AssetTransferPanel({ asset }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const [rejectTransfer, setRejectTransfer] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [acknowledgeTransfer, setAcknowledgeTransfer] = useState(null);
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [acknowledgement, setAcknowledgement] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const transfersQuery = useQuery({
    queryKey: ['asset-transfers', asset.id],
    queryFn: async () => (await apiClient.get('/asset-transfers', { params: { asset: asset._id, limit: 100 } })).data.data.items
  });
  const refresh = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['asset'] }),
    queryClient.invalidateQueries({ queryKey: ['assets'] }),
    queryClient.invalidateQueries({ queryKey: ['asset-transfers', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset-assignments', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset-current-assignment', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset-history', asset.id] })
  ]);
  const mutation = useMutation({
    mutationFn: async ({ path, body, images, direct }) => {
      const response = await apiClient.post(path, body);
      let transferContext = null;
      if (direct) {
        const transfer = response.data.data.transfer;
        transferContext = { from: transfer.fromEmployee?.fullName ?? '', to: transfer.toEmployee?.fullName ?? '' };
        await apiClient.post(`/asset-transfers/${transfer.id}/approve`, { decision: 'APPROVED' });
        await apiClient.post(`/asset-transfers/${transfer.id}/process`, {});
        await apiClient.post(`/asset-transfers/${transfer.id}/acknowledge`, { receivedBy: transfer.toEmployee?._id ?? transfer.toEmployee?.id, acknowledgement: 'Transfer completed during request.' });
        await apiClient.post(`/asset-transfers/${transfer.id}/complete`, {});
      }
      if (images?.length) {
        const formData = new FormData();
        images.forEach((image) => formData.append('images', image));
        if (transferContext) {
          formData.append('transferFrom', transferContext.from);
          formData.append('transferTo', transferContext.to);
        }
        await apiClient.post(`/assets/${asset.id}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return response;
    },
    onSuccess: async (_, variables) => {
      await refresh();
      setRequestOpen(false);
      setRejectTransfer(null);
      setAcknowledgeTransfer(null);
      setRejectionReason('');
      setAcknowledgement('');
      setNotice({ open: true, message: variables.message, severity: 'success' });
    },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const canTransfer = can(user, 'assets.transfer');

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Box><Typography variant="h6" fontWeight={700}>Transfer history</Typography><Typography variant="body2" color="text.secondary">Transfers require IT approval and recorded receiving acknowledgement.</Typography></Box>
        {canTransfer && asset.currentCustodian && !asset.pendingTransfer && !['DAMAGED', 'UNUSABLE'].includes(asset.condition) && <Button variant="contained" onClick={() => setRequestOpen(true)}>Request transfer</Button>}
      </Stack>
      {asset.pendingTransfer && <Alert severity="info">A transfer is open for this asset. Lifecycle changes are locked until it is completed or cancelled.</Alert>}
      {transfersQuery.isError && <Alert severity="error">{errorMessage(transfersQuery.error)}</Alert>}
      {transfersQuery.isPending ? <Typography color="text.secondary">Loading transfer history…</Typography> : (transfersQuery.data ?? []).length === 0 ? <Typography color="text.secondary">No transfer records.</Typography> : <><Table size="small"><TableHead><TableRow><TableCell>Transfer</TableCell><TableCell>From</TableCell><TableCell>To</TableCell><TableCell>Requested</TableCell><TableCell>Status</TableCell>{canTransfer && <TableCell align="right">Actions</TableCell>}</TableRow></TableHead><TableBody>{transfersQuery.data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((transfer) => <TableRow key={transfer.id}><TableCell><Button size="small" onClick={() => setSelectedTransfer(transfer)}>{transfer.transferNumber}</Button></TableCell><TableCell>{transfer.fromEmployee?.fullName ?? '—'}</TableCell><TableCell>{transfer.toEmployee?.fullName ?? '—'}</TableCell><TableCell>{new Date(transfer.requestedAt).toLocaleDateString()}</TableCell><TableCell>{transfer.status}</TableCell>{canTransfer && <TableCell align="right"><Stack direction="row" justifyContent="flex-end" flexWrap="wrap">{transfer.status === 'REQUESTED' && <><Button size="small" onClick={() => mutation.mutate({ path: `/asset-transfers/${transfer.id}/approve`, body: { decision: 'APPROVED' }, message: 'Transfer approved.' })}>Approve</Button><Button size="small" color="error" onClick={() => { setRejectTransfer(transfer); setRejectionReason(''); }}>Reject</Button><Button size="small" onClick={() => mutation.mutate({ path: `/asset-transfers/${transfer.id}/cancel`, body: {}, message: 'Transfer cancelled.' })}>Cancel</Button></>}{transfer.status === 'APPROVED' && <><Button size="small" onClick={() => mutation.mutate({ path: `/asset-transfers/${transfer.id}/process`, body: {}, message: 'Transfer processed.' })}>Process</Button><Button size="small" onClick={() => mutation.mutate({ path: `/asset-transfers/${transfer.id}/cancel`, body: {}, message: 'Transfer cancelled.' })}>Cancel</Button></>}{transfer.status === 'PROCESSING' && (transfer.processingLeaseUntil && new Date(transfer.processingLeaseUntil) > new Date() ? <Typography variant="caption" color="warning.main">Processing</Typography> : <Button size="small" onClick={() => mutation.mutate({ path: `/asset-transfers/${transfer.id}/process`, body: {}, message: 'Transfer processing resumed.' })}>Resume process</Button>)}{transfer.status === 'PROCESSED' && <Button size="small" onClick={() => { setAcknowledgeTransfer(transfer); setAcknowledgement(''); }}>Record receipt</Button>}{transfer.status === 'ACKNOWLEDGED' && <Button size="small" onClick={() => mutation.mutate({ path: `/asset-transfers/${transfer.id}/complete`, body: {}, message: 'Transfer completed.' })}>Complete</Button>}</Stack></TableCell>}</TableRow>)}</TableBody></Table><TablePagination component="div" count={(transfersQuery.data ?? []).length} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(Number(event.target.value)); setPage(0); }} rowsPerPageOptions={[5, 10, 25]} /></>}
      <Dialog open={Boolean(selectedTransfer)} onClose={() => setSelectedTransfer(null)} fullWidth maxWidth="sm">
        <DialogTitle>Transfer {selectedTransfer?.transferNumber}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1}>
            <Typography><strong>Status:</strong> {selectedTransfer?.status ?? '—'}</Typography>
            <Typography><strong>From:</strong> {selectedTransfer?.fromEmployee?.fullName ?? '—'}</Typography>
            <Typography><strong>To:</strong> {selectedTransfer?.toEmployee?.fullName ?? '—'}</Typography>
            <Typography><strong>Requested:</strong> {selectedTransfer?.requestedAt ? new Date(selectedTransfer.requestedAt).toLocaleString() : '—'}</Typography>
            <Typography><strong>Location:</strong> {selectedTransfer?.location || '—'}</Typography>
            <Typography><strong>Previous condition:</strong> {selectedTransfer?.previousCondition || '—'}</Typography>
            <Typography><strong>New condition:</strong> {selectedTransfer?.newCondition || '—'}</Typography>
            <Typography><strong>Reason:</strong> {selectedTransfer?.reason || '—'}</Typography>
            <Typography><strong>Accessories:</strong> {(selectedTransfer?.accessories ?? []).join(', ') || '—'}</Typography>
            <Typography><strong>Notes:</strong> {selectedTransfer?.notes || '—'}</Typography>
            {selectedTransfer?.rejectionReason && <Typography color="error"><strong>Rejection reason:</strong> {selectedTransfer.rejectionReason}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedTransfer(null)}>Close</Button></DialogActions>
      </Dialog>
      <AssetTransferDialog open={requestOpen} asset={asset} saving={mutation.isPending} error={mutation.error ? errorMessage(mutation.error) : ''} onClose={() => setRequestOpen(false)} onSubmit={(values) => { if (!window.confirm('Are you sure you want to proceed with this transfer? It will be completed immediately.')) return; const { images, ...body } = values; mutation.mutate({ path: `/assets/${asset.id}/transfers`, body, images, direct: true, message: 'Asset transfer completed.' }); }} />
      <Dialog open={Boolean(rejectTransfer)} onClose={() => setRejectTransfer(null)} fullWidth maxWidth="sm"><DialogTitle>Reject transfer {rejectTransfer?.transferNumber}</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} label="Rejection reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setRejectTransfer(null)}>Cancel</Button><Button color="error" disabled={mutation.isPending || rejectionReason.trim().length < 3} onClick={() => mutation.mutate({ path: `/asset-transfers/${rejectTransfer.id}/approve`, body: { decision: 'REJECTED', rejectionReason }, message: 'Transfer rejected.' })}>Reject</Button></DialogActions></Dialog>
      <Dialog open={Boolean(acknowledgeTransfer)} onClose={() => setAcknowledgeTransfer(null)} fullWidth maxWidth="sm"><DialogTitle>Record receiving acknowledgement</DialogTitle><DialogContent><Typography variant="body2" color="text.secondary">Confirm that {acknowledgeTransfer?.toEmployee?.fullName} received the asset.</Typography><TextField autoFocus fullWidth multiline minRows={3} label="Acknowledgement details" value={acknowledgement} onChange={(event) => setAcknowledgement(event.target.value)} sx={{ mt: 2 }} /></DialogContent><DialogActions><Button onClick={() => setAcknowledgeTransfer(null)}>Cancel</Button><Button variant="contained" disabled={mutation.isPending || acknowledgement.trim().length < 1} onClick={() => mutation.mutate({ path: `/asset-transfers/${acknowledgeTransfer.id}/acknowledge`, body: { receivedBy: acknowledgeTransfer.toEmployee?._id, acknowledgement }, message: 'Receiving acknowledgement recorded.' })}>Record acknowledgement</Button></DialogActions></Dialog>
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert>}
    </Stack>
  );
}
