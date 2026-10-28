import { useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];

function currentLocalDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function downtimeParts(totalMinutes) {
  const total = Number(totalMinutes) || 0;
  return {
    downtimeDays: Math.floor(total / 1440),
    downtimeHours: Math.floor((total % 1440) / 60),
    downtimeMinutes: total % 60
  };
}

export default function MaintenanceCompleteDialog({ open, record, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  useEffect(() => {
    if (open) reset({
      diagnosis: record?.diagnosis ?? '', workPerformed: record?.workPerformed ?? '', partsReplaced: record?.partsReplaced?.join(', ') ?? '', cost: record?.cost ?? '',
      conditionAfter: record?.completionCondition ?? record?.conditionBefore ?? 'GOOD',
      ...downtimeParts(record?.downtimeMinutes), nextMaintenanceAt: record?.nextMaintenanceAt ? new Date(new Date(record.nextMaintenanceAt).getTime() - new Date(record.nextMaintenanceAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''
    });
  }, [open, record, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(({ downtimeDays, downtimeHours, downtimeMinutes, ...values }) => onSubmit({
        ...values,
        partsReplaced: values.partsReplaced ? values.partsReplaced.split(',').map((part) => part.trim()).filter(Boolean) : [],
        cost: values.cost === '' ? null : Number(values.cost),
        downtimeMinutes: (Number(downtimeDays) || 0) * 1440 + (Number(downtimeHours) || 0) * 60 + (Number(downtimeMinutes) || 0),
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
              <TextField label="Downtime (days)" type="number" inputProps={{ min: 0, step: 1 }} fullWidth {...register('downtimeDays')} />
              <TextField label="Downtime (hours)" type="number" inputProps={{ min: 0, max: 23, step: 1 }} fullWidth {...register('downtimeHours')} />
              <TextField label="Downtime (minutes)" type="number" inputProps={{ min: 0, max: 59, step: 1 }} fullWidth {...register('downtimeMinutes')} />
            </Stack>
            <Controller name="conditionAfter" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="maintenance-condition-label">Condition after work</InputLabel><Select {...field} labelId="maintenance-condition-label" label="Condition after work">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />

            <TextField label="Maintenance completed date" type="datetime-local" InputLabelProps={{ shrink: true }} inputProps={{ max: currentLocalDateTime() }} error={Boolean(errors.nextMaintenanceAt)} helperText={errors.nextMaintenanceAt?.message} {...register('nextMaintenanceAt', { validate: (value) => !value || new Date(value) <= new Date() || 'Maintenance completed date and time cannot be in the future' })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Complete maintenance'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
