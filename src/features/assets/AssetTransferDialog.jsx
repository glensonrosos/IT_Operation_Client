import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Button, CircularProgress, LinearProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];

export default function AssetTransferDialog({ open, asset, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const selectedEmployeeId = useWatch({ control, name: 'toEmployee' });
  const [search, setSearch] = useState('');
  const [images, setImages] = useState([]);
  const term = useDebouncedValue(search);
  const employeesQuery = useQuery({
    queryKey: ['asset-transfer-employees', term],
    enabled: open,
    queryFn: async () => (await apiClient.get('/employees', { params: { status: 'ACTIVE', search: term, limit: 25 } })).data.data.items
  });
  const employees = employeesQuery.data ?? [];
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  const employeeOptions = selectedEmployee && !employees.some((employee) => employee.id === selectedEmployee.id) ? [selectedEmployee, ...employees] : employees;

  useEffect(() => {
    if (open) reset({ toEmployee: '', newCondition: asset?.condition ?? 'GOOD', location: asset?.location ?? '', reason: '', accessories: '', notes: '' });
    setSearch('');
    setImages([]);
  }, [asset, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        ...values,
        images,
        accessories: values.accessories ? values.accessories.split(',').map((item) => item.trim()).filter(Boolean) : []
      }))}>
        <DialogTitle>Request transfer for {asset?.assetId}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <FormHelperText error>{error}</FormHelperText>}
            <Controller name="toEmployee" control={control} rules={{ required: 'Select the new custodian' }} render={({ field }) => <Autocomplete
              options={employeeOptions}
              loading={employeesQuery.isFetching}
              value={selectedEmployee}
              inputValue={selectedEmployee ? `${selectedEmployee.fullName} - ${selectedEmployee.department?.departmentName ?? 'No department'}` : search}
              onInputChange={(_, value, reason) => { if (reason === 'input' || reason === 'clear') setSearch(value); }}
              onChange={(_, employee) => { field.onChange(employee?.id ?? ''); setSearch(employee ? `${employee.fullName} - ${employee.department?.departmentName ?? 'No department'}` : ''); }}
              getOptionLabel={(employee) => `${employee.fullName} - ${employee.department?.departmentName ?? 'No department'}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="New custodian" error={Boolean(errors.toEmployee)} helperText={errors.toEmployee?.message ?? 'Search by employee name or ID'} />}
            />} />
            <Controller name="newCondition" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="transfer-condition-label">Condition at transfer</InputLabel><Select {...field} labelId="transfer-condition-label" label="Condition at transfer">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />
            <TextField label="New location" {...register('location')} />
            <Stack spacing={1}><Button variant="outlined" component="label">Upload condition images<input hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setImages(Array.from(event.target.files ?? []))} /></Button>{images.length > 0 && <FormHelperText>{images.length} image{images.length === 1 ? '' : 's'} selected</FormHelperText>}</Stack>
            <TextField label="Transfer reason" multiline minRows={2} error={Boolean(errors.reason)} helperText={errors.reason?.message} {...register('reason', { required: 'Enter a transfer reason', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Accessories" helperText="Separate items with commas" {...register('accessories')} />
            <TextField label="Notes" multiline minRows={2} {...register('notes')} />
          </Stack>
        </DialogContent>
<DialogActions sx={{ p: 2, position: 'relative' }}>{saving && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />}<Button onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}>{saving ? 'Uploading condition images…' : 'Submit transfer request'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
