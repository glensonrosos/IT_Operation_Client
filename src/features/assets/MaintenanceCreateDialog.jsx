import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';

const types = ['PREVENTIVE', 'REPAIR', 'UPGRADE'];

export default function MaintenanceCreateDialog({ open, asset, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const ticketsQuery = useQuery({
    queryKey: ['asset-maintenance-tickets', asset?.id],
    enabled: open && Boolean(asset?.id),
    queryFn: async () => (await apiClient.get('/tickets', { params: { asset: asset._id, limit: 100 } })).data.data.items
  });

  useEffect(() => {
    if (open) {
      const now = new Date();
      const scheduledAt = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      reset({ type: 'PREVENTIVE', title: '', issueDescription: '', diagnosis: '', vendor: '', workOrderNumber: '', warrantyClaim: false, warrantyReference: '', scheduledAt, relatedTicket: '' });
    }
  }, [asset, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        ...values,
        asset: asset.id,
        relatedTicket: values.relatedTicket || undefined,
        scheduledAt: values.scheduledAt ? new Date(values.scheduledAt).toISOString() : undefined
      }))}>
        <DialogTitle>Log maintenance for {asset?.assetId}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Controller name="type" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="maintenance-type-label">Maintenance type</InputLabel><Select {...field} labelId="maintenance-type-label" label="Maintenance type">{types.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}</Select></FormControl>} />
            <TextField label="Title" error={Boolean(errors.title)} helperText={errors.title?.message} {...register('title', { required: 'Enter a title', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Issue or maintenance plan" multiline minRows={3} error={Boolean(errors.issueDescription)} helperText={errors.issueDescription?.message} {...register('issueDescription', { required: 'Describe the issue or planned work', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Diagnosis" multiline minRows={2} {...register('diagnosis')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Vendor" fullWidth {...register('vendor')} />
              <TextField label="Work order number" fullWidth {...register('workOrderNumber')} />
            </Stack>
            <TextField label="Scheduled date" type="datetime-local" InputLabelProps={{ shrink: true }} {...register('scheduledAt')} />
            <Controller name="warrantyClaim" control={control} render={({ field }) => <FormControlLabel label="Process as a warranty claim" control={<Checkbox checked={Boolean(field.value)} onChange={(_, checked) => field.onChange(checked)} />} />} />
            <TextField label="Warranty claim reference" {...register('warrantyReference')} />
            <Controller name="relatedTicket" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="maintenance-ticket-label">Related ticket (optional)</InputLabel><Select {...field} labelId="maintenance-ticket-label" label="Related ticket (optional)"><MenuItem value="">None</MenuItem>{(ticketsQuery.data ?? []).map((ticket) => <MenuItem key={ticket.id} value={ticket.id}>{ticket.ticketNumber} · {ticket.title}</MenuItem>)}</Select></FormControl>} />
            {asset?.currentCustodian && <FormHelperText>Preventive and inspection entries are allowed while assigned; return the asset before opening repair work.</FormHelperText>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Create maintenance record'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
