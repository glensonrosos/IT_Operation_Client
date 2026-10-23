import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR'];

export default function AssetAssignmentDialog({ open, asset, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const searchTerm = useDebouncedValue(employeeSearch);
  const employeesQuery = useQuery({
    queryKey: ['asset-assignment-employees', searchTerm],
    enabled: open,
    queryFn: async () => (await apiClient.get('/employees', { params: { status: 'ACTIVE', ...(searchTerm ? { search: searchTerm } : {}), limit: 100 } })).data.data.items
  });

  useEffect(() => {
    if (open) reset({ employee: '', condition: asset?.condition ?? 'GOOD', accessories: '', notes: '' });
    setEmployeeSearch('');
    setSelectedEmployee(null);
  }, [asset, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        ...values,
        accessories: values.accessories ? values.accessories.split(',').map((item) => item.trim()).filter(Boolean) : []
      }))}>
        <DialogTitle>Assign asset {asset?.assetId}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <FormHelperText error>{error}</FormHelperText>}
            <Controller name="employee" control={control} rules={{ required: 'Select an active employee' }} render={({ field }) => <Autocomplete
              options={employeesQuery.data ?? []}
              loading={employeesQuery.isFetching}
              value={selectedEmployee}
              inputValue={employeeSearch}
              onInputChange={(_, value) => setEmployeeSearch(value)}
              onChange={(_, employee) => { setSelectedEmployee(employee); setEmployeeSearch(employee ? `${employee.fullName} - ${employee.department?.departmentName ?? 'No department'}` : ''); field.onChange(employee?.id ?? ''); }}
              noOptionsText={employeesQuery.isError ? 'Unable to load employees' : searchTerm ? 'No matching active employees' : 'No active employees found'}
              getOptionLabel={(employee) => `${employee.fullName} - ${employee.department?.departmentName ?? 'No department'}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Employee" error={Boolean(errors.employee)} helperText={errors.employee?.message ?? 'Search by employee name or ID'} />}
            />} />
            <Controller name="condition" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="assignment-condition-label">Condition at assignment</InputLabel><Select {...field} labelId="assignment-condition-label" label="Condition at assignment">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />
            <TextField label="Accessories" helperText="Separate items with commas" {...register('accessories')} />
            <TextField label="Notes" multiline minRows={2} {...register('notes')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Assigning…' : 'Assign asset'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
