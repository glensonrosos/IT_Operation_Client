import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add, EditOutlined, SwapHoriz } from '@mui/icons-material';
import { Alert, Autocomplete, Box, Button, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Paper, Select, Stack, CircularProgress, LinearProgress, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel, TextField, Typography } from '@mui/material';
import { apiClient } from '../../api/client.js';
import { Link } from 'react-router-dom';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];

function CreateSparePartDialog({ open, types, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ defaultValues: { condition: 'NEW' } });
  const submit = (values) => { onSubmit(values); reset(); };
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(submit)}>
        <DialogTitle>Add spare part</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <ControllerPartType register={register} types={types} error={errors.partType?.message} />
            <TextField label="Model" error={Boolean(errors.model)} helperText={errors.model?.message} {...register('model', { required: 'Model is required' })} />
            <TextField label="Manufacturer" {...register('manufacturer')} />
            <TextField label="Description" multiline minRows={2} {...register('description')} />
            <TextField label="Notes" multiline minRows={2} {...register('notes')} />
            <FormControl fullWidth>
              <InputLabel id="sp-condition-label">Condition</InputLabel>
              <Select labelId="sp-condition-label" label="Condition" defaultValue="NEW" {...register('condition')}>
                {conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || !types.length}>{saving ? 'Creating…' : 'Create'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ControllerPartType({ register, types, error }) {
  return (
    <FormControl fullWidth error={Boolean(error)}>
      <InputLabel id="sp-type-label">Part type</InputLabel>
      <Select labelId="sp-type-label" label="Part type" defaultValue="" {...register('partType', { required: 'Select a spare-part type' })}>
        {types.filter((type) => type.isActive).map((type) => <MenuItem key={type.id} value={type.name}>{type.name}</MenuItem>)}
      </Select>
      {error && <Typography variant="caption" color="error">{error}</Typography>}
    </FormControl>
  );
}

export default function SparePartsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [partType, setPartType] = useState('');
  const [condition, setCondition] = useState('');
  const [open, setOpen] = useState(false);
  const [movement, setMovement] = useState(null);
  const [editPart, setEditPart] = useState(null);
  const [historyPart, setHistoryPart] = useState(null);
  const [movementAsset, setMovementAsset] = useState(null);
  const [movementAssetSearch, setMovementAssetSearch] = useState('');
  const [movementType, setMovementType] = useState('RECEIVED');
  const [movementImages, setMovementImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyRows, setHistoryRows] = useState(10);
  const [historySort, setHistorySort] = useState({ field: 'createdAt', direction: 'desc' });
  const [notice, setNotice] = useState('');
  const typesQuery = useQuery({ queryKey: ['spare-part-types'], queryFn: async () => (await apiClient.get('/spare-part-types')).data.data.items });
  const params = { page: page + 1, limit: rowsPerPage, search: search || undefined, partType: partType || undefined, condition: condition || undefined };
  const query = useQuery({ queryKey: ['spare-parts', params], queryFn: async () => (await apiClient.get('/spare-parts', { params })).data.data });
  const assetsQuery = useQuery({ queryKey: ['spare-part-assets', movementAssetSearch], enabled: Boolean(movement), queryFn: async () => (await apiClient.get('/assets', { params: { limit: 10, search: movementAssetSearch || undefined, includeArchived: 'false' } })).data.data.items });
  const historyQuery = useQuery({ queryKey: ['spare-part-history', historyPart?.id], enabled: Boolean(historyPart), queryFn: async () => { const items = (await apiClient.get(`/spare-parts/${historyPart.id}/history`)).data.data.items ?? []; return Promise.all(items.map(async (item) => ({ ...item, images: (await apiClient.get(`/spare-parts/movements/${item._id}/images`)).data.data.images ?? [] }))); } });
  const createMutation = useMutation({
    mutationFn: (body) => apiClient.post('/spare-parts', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      setOpen(false);
      setNotice('Spare part created.');
    },
    onError: (error) => setNotice(error?.response?.data?.message ?? 'Unable to create spare part.')
  });
  const editMutation = useMutation({
    mutationFn: ({ id, body }) => apiClient.patch(`/spare-parts/${id}`, body),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['spare-parts'] }); setEditPart(null); setNotice('Spare part updated.'); },
    onError: (error) => setNotice(error?.response?.data?.issues?.map((issue) => `${issue.path?.join('.') || 'field'}: ${issue.message}`).join('; ') || error?.response?.data?.message || 'Unable to update spare part.')
  });
  const movementMutation = useMutation({
    mutationFn: async ({ id, body, images }) => { const response = await apiClient.post(`/spare-parts/${id}/movements`, body); const movementId = response.data.data.movement?._id ?? response.data.data.movement?.id; if (movementId && images.length) { const formData = new FormData(); images.forEach((image) => formData.append('images', image)); await apiClient.post(`/spare-parts/movements/${movementId}/images`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }); } return response; },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['spare-parts'] });
      setMovement(null); setMovementAsset(null); setMovementAssetSearch(''); setMovementType('RECEIVED'); setMovementImages([]);
      setNotice('Stock movement recorded.');
    },
    onError: (error) => setNotice(error?.response?.data?.issues?.map((issue) => issue.message).join('; ') || error?.response?.data?.message || 'Unable to record stock movement.')
  });

  if (!can(user, 'spareParts.view')) {
    return (
      <Box>
        <DirectoryNavigation />
        <Container sx={{ py: 4 }}>
          <Alert severity="error">You do not have permission to view spare parts.</Alert>
        </Container>
      </Box>
    );
  }

  const types = (typesQuery.data ?? []).filter((type) => type.isActive);
  const rows = query.data?.items ?? [];
  const pagination = query.data?.pagination;
  const historyEntries = [...(historyQuery.data ?? [])].sort((a, b) => { const av = a[historySort.field] ?? ''; const bv = b[historySort.field] ?? ''; return (av < bv ? -1 : av > bv ? 1 : 0) * (historySort.direction === 'asc' ? 1 : -1); });
  const visibleHistory = historyEntries.slice(historyPage * historyRows, (historyPage + 1) * historyRows);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main">Asset operations</Typography>
              <Typography variant="h4" fontWeight={700}>Spare parts</Typography>
              <Typography color="text.secondary">Track replacement hardware such as SSDs and RAM. Consumables are intentionally excluded.</Typography>
            </Box>
            {can(user, 'spareParts.manage') && <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add spare part</Button>}
          </Stack>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}><TextField fullWidth size="small" label="Search part name, type, manufacturer" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} /><FormControl size="small" sx={{ minWidth: 220 }}><InputLabel id="sp-part-type-filter">Part type</InputLabel><Select labelId="sp-part-type-filter" label="Part type" value={partType} onChange={(event) => { setPartType(event.target.value); setPage(0); }}><MenuItem value="">All part types</MenuItem>{types.map((type) => <MenuItem key={type.id} value={type.name}>{type.name}</MenuItem>)}</Select></FormControl><FormControl size="small" sx={{ minWidth: 180 }}><InputLabel id="sp-condition-filter">Condition</InputLabel><Select labelId="sp-condition-filter" label="Condition" value={condition} onChange={(event) => { setCondition(event.target.value); setPage(0); }}><MenuItem value="">All conditions</MenuItem>{conditions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Stack>
          {notice && <Alert onClose={() => setNotice('')}>{notice}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Part number</TableCell>
                                    <TableCell>Type</TableCell>
                  <TableCell>Model</TableCell>
                  <TableCell>Manufacturer</TableCell>
                  <TableCell>Condition</TableCell>
                  <TableCell>On hand</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((part) => (
                  <TableRow key={part.id}>
                    <TableCell>{part.partNumber}</TableCell>
                                        <TableCell>{part.partType}</TableCell>
                    <TableCell>{part.model || '—'}</TableCell>
                    <TableCell>{part.manufacturer || '—'}</TableCell>
                    <TableCell>{part.conditionQuantities?.length ? part.conditionQuantities.join(', ') : part.condition}</TableCell>
                    <TableCell>{part.quantityOnHand}</TableCell>
                    <TableCell><Stack direction="row"><Button size="small" variant="contained" startIcon={<SwapHoriz />} onClick={() => setMovement(part)}>Stock </Button> &nbsp; {can(user, 'spareParts.manage') &&  <Button size="small" startIcon={<EditOutlined />} onClick={() => setEditPart(part)} variant="outlined" color='secondary'>Edit</Button> }&nbsp; <Button size="small" color="primary" variant="outlined" onClick={() => { setHistoryPart(part); setHistoryPage(0); }}>History</Button> </Stack></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination component="div" count={pagination?.total ?? 0} page={page} onPageChange={(_, nextPage) => setPage(nextPage)} rowsPerPage={rowsPerPage} onRowsPerPageChange={(event) => { setRowsPerPage(parseInt(event.target.value, 10)); setPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} />
          </TableContainer>
        </Stack>
      </Container>
      <Dialog open={Boolean(editPart)} onClose={() => setEditPart(null)} fullWidth maxWidth="sm"><form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); editMutation.mutate({ id: editPart.id, body: { model: form.get('model'), manufacturer: form.get('manufacturer'), description: form.get('description'), notes: form.get('notes'), conditionQuantities: form.getAll('conditionQuantities') } }); }}><DialogTitle>Edit spare part</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField name="model" label="Model" defaultValue={editPart?.model ?? ''} /><TextField name="manufacturer" label="Manufacturer" defaultValue={editPart?.manufacturer ?? ''} /><TextField name="description" label="Description" multiline minRows={2} defaultValue={editPart?.description ?? ''} /><TextField name="notes" label="Notes" multiline minRows={2} defaultValue={editPart?.notes ?? ''} /><FormControl fullWidth><InputLabel id="edit-sp-condition-label">Conditions in stock</InputLabel><Select multiple labelId="edit-sp-condition-label" label="Conditions in stock" name="conditionQuantities" defaultValue={editPart?.conditionQuantities ?? (editPart?.condition ? [editPart.condition] : [])}>{conditions.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl></Stack></DialogContent><DialogActions><Button onClick={() => setEditPart(null)}>Cancel</Button><Button type="submit" variant="contained" disabled={editMutation.isPending}>Save</Button></DialogActions></form></Dialog>
      <CreateSparePartDialog open={open} types={types} saving={createMutation.isPending} error={createMutation.error?.response?.data?.message ?? ''} onClose={() => setOpen(false)} onSubmit={(values) => createMutation.mutate(values)} />
      <Dialog open={Boolean(movement)} onClose={() => setMovement(null)}>
        <DialogTitle>Spare-part stock movement</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField id="sp-move-type" select label="Movement" value={movementType} onChange={(event) => { setMovementType(event.target.value); setMovementAsset(null); }} SelectProps={{ native: true }}>
              <option value="RECEIVED">Received</option>
              <option value="ISSUED">Issued</option>
              <option value="ADJUSTED">Adjusted</option>
              
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
            </TextField>
            <TextField id="sp-move-qty" label="Quantity" type="number" defaultValue={1} />
            <TextField id="sp-move-reason" label="Reason / Reference" multiline minRows={2} helperText="Enter at least 3 characters." />
            {movementType === 'ISSUED' && <TextField id="sp-move-ticket" label="Related Ticket ID" helperText="Optional ticket ID for this issued part." />}
            {movementType === 'ISSUED' && <Autocomplete options={(assetsQuery.data ?? []).slice(0, 10)} value={movementAsset} inputValue={movementAssetSearch} onInputChange={(_, value) => setMovementAssetSearch(value)} onChange={(_, value) => { setMovementAsset(value); setMovementAssetSearch(value ? `${value.currentCustodian?.fullName ?? 'Unassigned'} - ${value.department?.departmentName ?? 'No department'} - ${value.assetName}` : ''); }} getOptionLabel={(asset) => `${asset.currentCustodian?.fullName ?? 'Unassigned'} - ${asset.department?.departmentName ?? 'No department'} - ${asset.assetName}`} isOptionEqualToValue={(a, b) => a.id === b.id} noOptionsText="No matching custodian assets" renderInput={(params) => <TextField {...params} label="Installed asset" helperText="Search custodian name; showing up to 10 assets." />} />}
            <Button component="label" variant="outlined">Attach movement image<input hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setMovementImages(Array.from(event.target.files ?? []))} /></Button>{movementImages.length > 0 && <Typography variant="caption">{movementImages.length} image(s) selected: {movementImages.map((image) => image.name).join(', ')}</Typography>}</Stack>
        </DialogContent>
        <DialogActions sx={{ position: "relative" }}>{movementMutation.isPending && <LinearProgress sx={{ position: "absolute", left: 0, right: 0, top: 0 }} />}<Button onClick={() => setMovement(null)} disabled={movementMutation.isPending}>Cancel</Button><Button variant="contained" onClick={() => { const relatedTicket = document.getElementById('sp-move-ticket')?.value.trim(); if (movementType === 'ISSUED' && !movementAsset && !relatedTicket) { setNotice('Issued movements require a Related Ticket ID or an Installed Asset.'); return; } movementMutation.mutate({ id: movement.id, images: movementImages, body: { type: document.getElementById('sp-move-type').value, quantity: Number(document.getElementById('sp-move-qty').value), reason: document.getElementById('sp-move-reason').value.trim(), reference: movementAsset?.assetId ?? '', relatedTicket: relatedTicket || undefined } }); }} disabled={movementMutation.isPending} startIcon={movementMutation.isPending ? <CircularProgress size={18} color="inherit" /> : null}>{movementMutation.isPending ? 'Uploading image�' : 'Record'}</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} maxWidth="lg"><DialogTitle>{previewImage?.name}</DialogTitle><DialogContent dividers><Box component="img" src={previewImage?.url} alt={previewImage?.name ?? 'Movement image'} sx={{ display: 'block', maxWidth: 'min(90vw, 1100px)', maxHeight: '75vh', mx: 'auto', objectFit: 'contain' }} /></DialogContent><DialogActions><Button onClick={() => setPreviewImage(null)}>Close</Button></DialogActions></Dialog>
      <Dialog open={Boolean(historyPart)} onClose={() => setHistoryPart(null)} fullWidth maxWidth="xl">
        <DialogTitle>Stock history — {historyPart?.partName}</DialogTitle>
        <DialogContent><Table size="small"><TableHead><TableRow><TableCell><TableSortLabel active={historySort.field === 'createdAt'} direction={historySort.field === 'createdAt' ? historySort.direction : 'asc'} onClick={() => setHistorySort({ field: 'createdAt', direction: historySort.field === 'createdAt' && historySort.direction === 'asc' ? 'desc' : 'asc' })}>Date</TableSortLabel></TableCell><TableCell><TableSortLabel active={historySort.field === 'type'} direction={historySort.field === 'type' ? historySort.direction : 'asc'} onClick={() => setHistorySort({ field: 'type', direction: historySort.field === 'type' && historySort.direction === 'asc' ? 'desc' : 'asc' })}>Movement</TableSortLabel></TableCell><TableCell sx={{ minWidth: 120 }}><TableSortLabel active={historySort.field === 'quantity'} direction={historySort.field === 'quantity' ? historySort.direction : 'asc'} onClick={() => setHistorySort({ field: 'quantity', direction: historySort.field === 'quantity' && historySort.direction === 'asc' ? 'desc' : 'asc' })}>Quantity</TableSortLabel></TableCell><TableCell sx={{ minWidth: 150 }}>Stock</TableCell><TableCell>Reason / reference</TableCell><TableCell>Recorded by</TableCell><TableCell>Image attached</TableCell></TableRow></TableHead><TableBody>{visibleHistory.map((entry) => <TableRow key={entry._id}><TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell><TableCell>{entry.type}</TableCell><TableCell>{entry.quantity}</TableCell><TableCell>{entry.previousQuantity} → {entry.newQuantity}</TableCell><TableCell>{entry.reason}{entry.referenceAsset ? <> � <Button component={Link} to={`/assets/${entry.referenceAsset.id}?tab=10`} size="small" sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>{entry.referenceAsset.assetId}</Button></> : entry.reference ? ` � ${entry.reference}` : ''}{entry.relatedTicket && <> � <Button component={Link} to={`/tickets/${entry.relatedTicket._id ?? entry.relatedTicket.id}`} size="small" sx={{ p: 0, minWidth: 0, verticalAlign: 'baseline' }}>{entry.relatedTicket.ticketNumber}</Button></>}</TableCell><TableCell>{entry.actor?.firstName ? `${entry.actor.firstName} ${entry.actor.lastName ?? ''}`.trim() : entry.actor?.username ?? '�'}</TableCell><TableCell>{entry.images?.length ? entry.images.map((image) => <Box key={image._id} sx={{ display: 'inline-flex', flexDirection: 'column', mr: 1 }}><Box component="img" src={`/api/spare-parts/movements/${entry._id}/images/${image._id}`} alt={image.originalName} onDoubleClick={() => setPreviewImage({ url: `/api/spare-parts/movements/${entry._id}/images/${image._id}`, name: image.originalName })} sx={{ width: 72, height: 72, objectFit: 'cover', display: 'block', cursor: 'zoom-in' }} /><Button component="a" href={`/api/spare-parts/movements/${entry._id}/images/${image._id}`} download={image.originalName} size="small">Download</Button></Box>) : 'No image attached'}</TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={historyEntries.length} page={historyPage} onPageChange={(_, value) => setHistoryPage(value)} rowsPerPage={historyRows} onRowsPerPageChange={(event) => { setHistoryRows(Number(event.target.value)); setHistoryPage(0); }} rowsPerPageOptions={[5, 10, 20, 50]} /></DialogContent><DialogActions><Button onClick={() => setHistoryPart(null)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
