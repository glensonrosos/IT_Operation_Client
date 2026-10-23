import { useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];
export default function MaintenanceCompleteDialog({ open, record, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (open) reset({
      diagnosis: record?.diagnosis ?? '', workPerformed: record?.workPerformed ?? '', partsReplaced: record?.partsReplaced?.join(', ') ?? '', cost: record?.cost ?? '', currency: record?.currency ?? 'USD',
      conditionAfter: record?.completionCondition ?? record?.conditionBefore ?? 'GOOD',
      downtimeMinutes: record?.downtimeMinutes ?? '', nextMaintenanceAt: record?.nextMaintenanceAt ? new Date(new Date(record.nextMaintenanceAt).getTime() - new Date(record.nextMaintenanceAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''
    });
  }, [open, record, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        ...values,
        partsReplaced: values.partsReplaced ? values.partsReplaced.split(',').map((part) => part.trim()).filter(Boolean) : [],
        cost: values.cost === '' ? null : Number(values.cost),
        downtimeMinutes: values.downtimeMinutes === '' ? undefined : Number(values.downtimeMinutes),
        nextMaintenanceAt: values.nextMaintenanceAt ? new Date(values.nextMaintenanceAt).toISOString() : undefined
      }))}>
        <DialogTitle>Complete {record?.maintenanceNumber}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <FormHelperText error>{error}</FormHelperText>}
            <TextField label="Diagnosis" multiline minRows={2} {...register('diagnosis')} />
            <TextField label="Work performed" multiline minRows={3} error={Boolean(errors.workPerformed)} helperText={errors.workPerformed?.message} {...register('workPerformed', { required: 'Describe the work performed', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Parts replaced" helperText="Separate parts with commas" {...register('partsReplaced')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Cost" type="number" inputProps={{ min: 0, step: '0.01' }} fullWidth {...register('cost')} />
              <TextField label="Currency" inputProps={{ maxLength: 3 }} fullWidth {...register('currency')} />
              <TextField label="Downtime (minutes)" type="number" inputProps={{ min: 0, step: 1 }} fullWidth {...register('downtimeMinutes')} />
            </Stack>
            <Controller name="conditionAfter" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="maintenance-condition-label">Condition after work</InputLabel><Select {...field} labelId="maintenance-condition-label" label="Condition after work">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />

            <TextField label="Next maintenance date" type="datetime-local" InputLabelProps={{ shrink: true }} {...register('nextMaintenanceAt')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Complete maintenance'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
