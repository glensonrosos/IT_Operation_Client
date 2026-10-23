import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Popper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import BorrowingCheckoutDialog from './BorrowingCheckoutDialog.jsx';
import BorrowingCheckinDialog from './BorrowingCheckinDialog.jsx';

function errorMessage(error) {
  const response = error?.response?.data;
  if (response?.issues?.length) return `${response.message ?? 'Validation failed'}: ${response.issues.map((issue) => `${issue.path?.join('.') || 'field'} — ${issue.message}`).join('; ')}`;
  return response?.message ?? 'The borrowing operation could not be completed.';
}

function BorrowingAssetLink({ assetId, assetLabel }) {
  const [hovered, setHovered] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const imageQuery = useQuery({
    queryKey: ['borrowing-asset-preview', assetId],
    enabled: hovered && Boolean(assetId),
    queryFn: async () => (await apiClient.get(`/assets/${assetId}/images`)).data.data.images
  });
  const image = imageQuery.data?.[0];

  return (
    <Box sx={{ position: 'relative' }}>
      <Button component={Link} to={`/assets/${assetId}`} size="small" sx={{ alignSelf: 'flex-start' }} onMouseEnter={(event) => { setHovered(true); setAnchorEl(event.currentTarget); }} onMouseLeave={() => { setHovered(false); setAnchorEl(null); }}>{assetLabel}</Button>
      {image && <Popper open={hovered} anchorEl={anchorEl} placement="right-start" sx={{ zIndex: 1500, pointerEvents: 'none' }}>
        <Box sx={{ p: 0.75, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 6 }}>
          <Box component="img" src={`/api/assets/${assetId}/images/${image._id ?? image.id}`} alt={`${assetLabel} preview`} sx={{ display: 'block', width: 420, height: 420, objectFit: 'contain', bgcolor: 'grey.100', borderRadius: 1 }} />
        </Box>
      </Popper>}
    </Box>
  );
}

export default function BorrowingDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkinItem, setCheckinItem] = useState(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [notice, setNotice] = useState({ open: false, text: '', severity: 'success' });
  const [previewImage, setPreviewImage] = useState(null);
  const borrowingQuery = useQuery({ queryKey: ['borrowing', id], queryFn: async () => (await apiClient.get(`/borrowings/${id}`)).data.data.borrowing });
  const borrowing = borrowingQuery.data;
  const borrowingImagesQuery = useQuery({
    queryKey: ['borrowing-images', borrowing?.items?.map((item) => item.asset?._id ?? item.asset).join(',')],
    enabled: Boolean(borrowing?.items?.length),
    queryFn: async () => {
      const entries = await Promise.all((borrowing.items ?? []).map(async (item) => {
        const assetId = item.asset?._id ?? item.asset;
        if (!assetId) return [];
        const images = (await apiClient.get(`/assets/${assetId}/images`, { params: { borrowing: id } })).data.data.images ?? [];
        return images.map((image) => ({ ...image, assetId, assetName: item.assetNameSnapshot }));
      }));
      return entries.flat();
    }
  });
  const mutation = useMutation({
    mutationFn: async ({ path, body }) => {
      const { conditionImages = [], ...payload } = body;
      const response = await apiClient.post(path, payload);
      if (conditionImages.length && payload.items?.[0]?.itemId) {
        const item = response.data.data.borrowing?.items?.find((entry) => entry._id === payload.items[0].itemId);
        const assetId = item?.asset?._id ?? item?.asset;
        if (assetId) {
          const formData = new FormData();
          conditionImages.forEach((image) => formData.append('images', image));
          formData.append('uploadedVia', 'Returned / Check-in');
          formData.append('borrowing', response.data.data.borrowing?.id ?? response.data.data.borrowing?._id);
          await apiClient.post(`/assets/${assetId}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        }
      }
      return response;
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['borrowing', id] }),
        queryClient.invalidateQueries({ queryKey: ['borrowings'] }),
        queryClient.invalidateQueries({ queryKey: ['assets'] })
      ]);
      setCheckoutOpen(false);
      setCheckinItem(null);
      setRejectOpen(false);
      setRejectionReason('');
      setNotice({ open: true, text: response.data.message ?? 'Borrowing updated.', severity: 'success' });
    },
    onError: (error) => setNotice({ open: true, text: errorMessage(error), severity: 'error' })
  });

  if (borrowingQuery.isPending) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (borrowingQuery.isError) return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}><DirectoryNavigation /><Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">{errorMessage(borrowingQuery.error)}</Alert></Container></Box>;

  const canApprove = can(user, 'borrowing.approve');
  const canCheckout = can(user, 'borrowing.checkout');
  const canCheckin = can(user, 'borrowing.checkin');
  const canCancel = can(user, 'borrowing.cancel');
  const checkoutLeaseExpired = !borrowing.checkoutLeaseUntil || new Date(borrowing.checkoutLeaseUntil) <= new Date();
  const checkoutValues = { items: borrowing.items.map((item) => ({ itemId: item._id, condition: item.checkoutCondition ?? 'GOOD', accessories: item.checkoutAccessories ?? [], notes: item.checkoutNotes ?? '' })) };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={2}>
              <Box sx={{ flex: 1 }}><Typography variant="overline" color="primary.main" fontWeight={700}>{borrowing.borrowingNumber}</Typography><Typography variant="h4" component="h1" fontWeight={700}>Equipment borrowing</Typography><Typography color="text.secondary">{borrowing.borrowerSnapshot.fullName} ({borrowing.borrowerSnapshot.employeeId}) · {borrowing.borrowerSnapshot.departmentName}</Typography></Box>
              <Chip label={borrowing.status.replaceAll('_', ' ')} color={borrowing.status === 'RETURNED' ? 'success' : borrowing.status === 'LOSS_REVIEW' || borrowing.isOverdue ? 'error' : 'default'} />
              {borrowing.isOverdue && <Chip color="error" label={`${borrowing.outstandingItemCount} overdue item(s)`} />}
              {canApprove && borrowing.status === 'REQUESTED' && <><Button variant="contained" onClick={() => mutation.mutate({ path: `/borrowings/${id}/approve`, body: { decision: 'APPROVED' } })}>Approve</Button><Button color="error" onClick={() => { setRejectOpen(true); setRejectionReason(''); }}>Reject</Button></>}
              {canCheckout && borrowing.status === 'APPROVED' && <Button variant="contained" onClick={() => mutation.mutate({ path: `/borrowings/${id}/ready`, body: {} })}>Prepare for release</Button>}
              {canCheckout && borrowing.status === 'READY_FOR_RELEASE' && <Button variant="contained" onClick={() => setCheckoutOpen(true)}>Check out</Button>}
              {canCheckout && borrowing.status === 'CHECKING_OUT' && checkoutLeaseExpired && <Button variant="contained" onClick={() => mutation.mutate({ path: `/borrowings/${id}/checkout`, body: checkoutValues })}>Resume checkout</Button>}
              {canCancel && ['REQUESTED', 'APPROVED', 'READY_FOR_RELEASE'].includes(borrowing.status) && <Button color="warning" onClick={() => mutation.mutate({ path: `/borrowings/${id}/cancel`, body: {} })}>Cancel request</Button>}
            </Stack>
          </Paper>
          {borrowing.checkoutError && <Alert severity="warning">Previous checkout attempt: {borrowing.checkoutError}</Alert>}
          {borrowing.status === 'CHECKING_OUT' && !checkoutLeaseExpired && <Alert severity="info">Checkout is currently being processed. Retry is enabled after the recovery lease expires.</Alert>}
          {borrowing.status === 'LOSS_REVIEW' && <Alert severity="error">One or more items are recorded as lost. This borrowing remains open for IT loss follow-up.</Alert>}
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
            <Paper variant="outlined" sx={{ p: 2.5, flex: 2 }}><Typography variant="h6" fontWeight={700} gutterBottom>Requested equipment</Typography><Table size="small"><TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Status</TableCell><TableCell>Checkout condition</TableCell><TableCell>Return</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>{borrowing.items.map((item) => <TableRow key={item._id}><TableCell><Stack><BorrowingAssetLink assetId={item.asset?._id ?? item.asset} assetLabel={item.assetIdSnapshot} /><Typography variant="body2">{item.assetNameSnapshot}</Typography></Stack></TableCell><TableCell>{item.status}</TableCell><TableCell>{item.checkoutCondition ?? '—'}</TableCell><TableCell>{item.returnResult?.replaceAll('_', ' ') ?? '—'}{item.conditionAtReturn ? ` · ${item.conditionAtReturn}` : ''}{item.damageDescription && ['RETURNED_DAMAGED', 'RETURNED_INCOMPLETE', 'RETURNED_FOR_REPAIR', 'LOST'].includes(item.returnResult) && <Typography display="block" variant="caption" color="error.main">Reason: {item.damageDescription}</Typography>}{item.returnNotes && <Typography display="block" variant="caption" color="text.secondary">Notes: {item.returnNotes}</Typography>}</TableCell><TableCell>{canCheckin && item.status === 'RELEASED' && <Button variant="outlined" size="small" onClick={() => setCheckinItem(item)}>Check in</Button>}{item.status === 'LOST' && <Typography variant="caption" color="error.main">Loss review</Typography>}</TableCell></TableRow>)}</TableBody></Table>{(borrowingImagesQuery.data ?? []).length > 0 && <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 2 }}>{borrowingImagesQuery.data.map((image) => <Paper variant="outlined" key={image._id ?? image.id} sx={{ p: 1, width: 180 }}><Box component="img" src={`/api/assets/${image.assetId}/images/${image._id ?? image.id}`} alt={image.originalName} onDoubleClick={() => setPreviewImage({ url: `/api/assets/${image.assetId}/images/${image._id ?? image.id}`, name: image.originalName })} sx={{ width: '100%', height: 110, objectFit: 'contain', bgcolor: 'grey.100', cursor: 'zoom-in' }} /><Typography variant="caption" display="block" noWrap>{image.assetName}</Typography><Typography variant="caption" display="block" color="text.secondary">{image.uploadedVia || 'Asset image'}</Typography><Button component="a" href={`/api/assets/${image.assetId}/images/${image._id ?? image.id}`} download={image.originalName} size="small">Download</Button></Paper>)}</Stack>}</Paper>
            <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}><Typography variant="h6" fontWeight={700} gutterBottom>Request details</Typography><Stack spacing={1.2}><Typography><strong>Reason:</strong> {borrowing.requestReason}</Typography><Typography><strong>Requested:</strong> {new Date(borrowing.requestedAt).toLocaleString()}</Typography><Typography><strong>Due:</strong> {new Date(borrowing.dueAt).toLocaleString()}</Typography><Typography><strong>Requested by IT:</strong> {borrowing.requestedBy?.firstName} {borrowing.requestedBy?.lastName}</Typography>{borrowing.reviewNote && <Typography><strong>Review note:</strong> {borrowing.reviewNote}</Typography>}</Stack></Paper>
          </Stack>
          <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6" fontWeight={700} gutterBottom>Workflow history</Typography><Stack spacing={1}>{(borrowing.events ?? []).slice().reverse().map((entry) => <Stack key={entry._id} direction={{ xs: 'column', sm: 'row' }} spacing={1}><Typography fontWeight={600}>{entry.action}</Typography><Typography>{entry.description}</Typography><Typography variant="body2" color="text.secondary">{new Date(entry.at).toLocaleString()}</Typography></Stack>)}</Stack></Paper>
        </Stack>
      </Container>
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: (theme) => theme.zIndex.snackbar }}>{notice.text}</Alert>}
      <BorrowingCheckoutDialog open={checkoutOpen} borrowing={borrowing} saving={mutation.isPending} onClose={() => setCheckoutOpen(false)} onSubmit={(body) => mutation.mutate({ path: `/borrowings/${id}/checkout`, body })} />
      <BorrowingCheckinDialog open={Boolean(checkinItem)} borrowing={borrowing} item={checkinItem} saving={mutation.isPending} onClose={() => setCheckinItem(null)} onSubmit={({ conditionImages = [], ...item }) => mutation.mutate({ path: `/borrowings/${id}/checkin`, body: { items: [item], conditionImages } })} />
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="lg"><DialogTitle>{previewImage?.name}</DialogTitle><DialogContent dividers><Box component="img" src={previewImage?.url} alt={previewImage?.name ?? 'Borrowing evidence'} sx={{ display: 'block', maxWidth: 'min(90vw, 1100px)', maxHeight: '75vh', mx: 'auto', objectFit: 'contain' }} /></DialogContent><DialogActions><Button onClick={() => setPreviewImage(null)}>Close</Button></DialogActions></Dialog>
      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Reject borrowing request</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} label="Rejection reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} sx={{ mt: 1 }} /></DialogContent><DialogActions><Button onClick={() => setRejectOpen(false)}>Cancel</Button><Button color="error" disabled={mutation.isPending || rejectionReason.trim().length < 3} onClick={() => mutation.mutate({ path: `/borrowings/${id}/approve`, body: { decision: 'REJECTED', rejectionReason } })}>Reject request</Button></DialogActions></Dialog>
    </Box>
  );
}
