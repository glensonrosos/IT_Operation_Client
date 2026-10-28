import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { apiClient } from '../../api/client.js';

const results = ['RETURNED_GOOD', 'RETURNED_DAMAGED', 'RETURNED_INCOMPLETE', 'LOST'];
const conditions = ['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];
const inspections = ['PASS', 'FAIL', 'INCOMPLETE', 'REPAIR_REQUIRED'];

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function currentLocalDateTime() {
  return toLocalDateTime(new Date());
}

export default function BorrowingCheckinDialog({ open, borrowing, item, saving, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const [conditionImages, setConditionImages] = useState([]);
  const result = useWatch({ control, name: 'result' });
  const ticketsQuery = useQuery({
    queryKey: ['borrow-checkin-tickets', item?.asset?._id],
    enabled: open && Boolean(item?.asset?._id),
    queryFn: async () => (await apiClient.get('/tickets', { params: { asset: item.asset._id, limit: 100 } })).data.data.items
  });

  useEffect(() => {
    if (open) reset({ result: 'RETURNED_GOOD', conditionAfter: item?.asset?.condition ?? 'GOOD', inspectionResult: 'PASS', missingAccessories: '', damageDescription: '', notes: '', relatedTicket: '', returnedAt: toLocalDateTime(new Date()) });
    setConditionImages([]);
  }, [item, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        itemId: item._id,
        result: values.result,
        conditionAfter: values.result === 'LOST' ? undefined : values.conditionAfter,
        inspectionResult: values.inspectionResult,
        missingAccessories: values.missingAccessories ? values.missingAccessories.split(',').map((value) => value.trim()).filter(Boolean) : [],
        damageDescription: values.damageDescription || undefined,
        notes: values.notes || undefined,
        relatedTicket: values.relatedTicket || undefined,
        returnedAt: values.returnedAt ? new Date(values.returnedAt).toISOString() : undefined,
        conditionImages
      }))}>
        <DialogTitle>Check in {item?.assetIdSnapshot} · {borrowing?.borrowingNumber}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Controller name="result" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="borrow-return-result-label">Return result</InputLabel><Select {...field} labelId="borrow-return-result-label" label="Return result">{results.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>} />
            {result !== 'LOST' && <Controller name="conditionAfter" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="borrow-return-condition-label">Condition after return</InputLabel><Select {...field} labelId="borrow-return-condition-label" label="Condition after return">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />}
            {result !== 'LOST' && <Controller name="inspectionResult" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="borrow-inspection-label">Inspection result</InputLabel><Select {...field} labelId="borrow-inspection-label" label="Inspection result">{inspections.map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>} />}
            {result === 'RETURNED_INCOMPLETE' && <><TextField label="Missing accessories" helperText="Separate items with commas" {...register('missingAccessories')} /><TextField label="Reason for incomplete return" multiline minRows={2} {...register('damageDescription')} /></>}
            {['RETURNED_DAMAGED', 'LOST'].includes(result) && <TextField label={result === 'LOST' ? 'Loss details' : 'Damage details'} multiline minRows={2} {...register('damageDescription')} />}
            <Controller name="relatedTicket" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="borrow-related-ticket-label">Related ticket (optional)</InputLabel><Select {...field} labelId="borrow-related-ticket-label" label="Related ticket (optional)"><MenuItem value="">None</MenuItem>{(ticketsQuery.data ?? []).map((ticket) => <MenuItem key={ticket.id} value={ticket.id}>{ticket.ticketNumber} · {ticket.title}</MenuItem>)}</Select></FormControl>} />
            <TextField label="Return date" type="datetime-local" InputLabelProps={{ shrink: true }} inputProps={{ max: currentLocalDateTime() }} error={Boolean(errors.returnedAt)} helperText={errors.returnedAt?.message} {...register('returnedAt', { validate: (value) => !value || new Date(value) <= new Date() || 'Return date and time cannot be in the future' })} />
            <TextField label="Notes" multiline minRows={2} {...register('notes')} />
            <Button component="label" variant="outlined">Upload return condition images<input hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setConditionImages(Array.from(event.target.files ?? []))} /></Button>
            {conditionImages.length > 0 && <Typography variant="body2" color="text.secondary">{conditionImages.length} image(s) selected.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Checking in…' : 'Record check-in'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
