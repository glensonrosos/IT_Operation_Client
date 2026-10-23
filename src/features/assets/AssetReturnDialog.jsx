import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, CircularProgress, LinearProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];
const results = ['RETURNED_GOOD', 'RETURNED_DAMAGED', 'RETURNED_INCOMPLETE', 'RETURNED_FOR_REPAIR'];
const inspections = ['PASS', 'FAIL', 'INCOMPLETE', 'REPAIR_REQUIRED'];

function currentLocalDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function AssetReturnDialog({ open, asset, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const [images, setImages] = useState([]);
  const ticketsQuery = useQuery({
    queryKey: ['asset-return-tickets', asset?.id],
    enabled: open && Boolean(asset?.id),
    queryFn: async () => (await apiClient.get('/tickets', { params: { asset: asset.id, limit: 100 } })).data.data.items
  });

  useEffect(() => {
    if (open) reset({
      conditionAfter: asset?.condition ?? 'GOOD', result: 'RETURNED_GOOD', inspectionResult: 'PASS',
      missingAccessories: '', damageDescription: '', notes: '', relatedTicket: '', returnDate: ''
    });
    setImages([]);
  }, [asset, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        ...values,
        images,
        missingAccessories: values.missingAccessories ? values.missingAccessories.split(',').map((item) => item.trim()).filter(Boolean) : [],
        relatedTicket: values.relatedTicket || undefined,
        returnDate: values.returnDate ? new Date(values.returnDate).toISOString() : undefined
      }))}>
        <DialogTitle>Record return for {asset?.assetId}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <FormHelperText error>{error}</FormHelperText>}
            <Controller name="result" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="return-result-label">Return result</InputLabel><Select {...field} labelId="return-result-label" label="Return result">{results.map((result) => <MenuItem key={result} value={result}>{result.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>} />
            <Controller name="inspectionResult" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="return-inspection-label">Inspection result</InputLabel><Select {...field} labelId="return-inspection-label" label="Inspection result">{inspections.map((result) => <MenuItem key={result} value={result}>{result.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>} />
            <Controller name="conditionAfter" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="return-condition-label">Condition after return</InputLabel><Select {...field} labelId="return-condition-label" label="Condition after return">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />
            <TextField label="Missing accessories" helperText="Separate missing items with commas" {...register('missingAccessories')} />
            <TextField label="Damage or repair details" multiline minRows={2} {...register('damageDescription')} />
            <Controller name="relatedTicket" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="return-ticket-label">Related ticket (optional)</InputLabel><Select {...field} labelId="return-ticket-label" label="Related ticket (optional)"><MenuItem value="">None</MenuItem>{(ticketsQuery.data ?? []).map((ticket) => <MenuItem key={ticket.id} value={ticket.id}>{ticket.ticketNumber} Â· {ticket.title}</MenuItem>)}</Select></FormControl>} />
            <Stack spacing={1}><Button variant="outlined" component="label">Upload condition images<input hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setImages(Array.from(event.target.files ?? []))} /></Button>{images.length > 0 && <FormHelperText>{images.length} image{images.length === 1 ? '' : 's'} selected</FormHelperText>}</Stack>
            <TextField label="Return date" type="datetime-local" InputLabelProps={{ shrink: true }} inputProps={{ max: currentLocalDateTime() }} error={Boolean(errors.returnDate)} helperText={errors.returnDate?.message} {...register('returnDate', { validate: (value) => !value || new Date(value) <= new Date() || 'Return date cannot be in the future' })} />
            <TextField label="Notes" multiline minRows={2} {...register('notes')} />
          </Stack>
        </DialogContent>
<DialogActions sx={{ p: 2, position: 'relative' }}>{saving && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />}<Button onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}>{saving ? 'Uploading condition images…' : 'Record return'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
