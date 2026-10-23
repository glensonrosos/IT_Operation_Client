import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

export default function DepartmentFormDialog({ open, department, saving, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control } = useForm();
  const [employeeSearch, setEmployeeSearch] = useState('');
  const searchTerm = useDebouncedValue(employeeSearch);
  const employeesQuery = useQuery({
    queryKey: ['department-head-options', searchTerm],
    enabled: open,
    queryFn: async () => (await apiClient.get('/employees', { params: { status: 'ACTIVE', search: searchTerm || undefined, limit: 25 } })).data.data.items
  });
  const currentHead = department?.departmentHead ? {
    ...department.departmentHead,
    id: department.departmentHead.id ?? department.departmentHead._id
  } : null;
  const employeeOptions = [...(employeesQuery.data ?? [])];
  if (currentHead && !employeeOptions.some((employee) => employee.id === currentHead.id)) employeeOptions.unshift(currentHead);

  useEffect(() => {
    reset({
      departmentCode: department?.departmentCode ?? '', departmentName: department?.departmentName ?? '',
      description: department?.description ?? '', departmentHead: currentHead?.id ?? '',
      location: department?.location ?? '', status: department?.status ?? 'ACTIVE'
    });
    setEmployeeSearch('');
  }, [department, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{department ? 'Edit department' : 'Add department'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Department code" disabled={Boolean(department)} {...register('departmentCode', { required: 'Department code is required' })} />
            <TextField label="Department name" {...register('departmentName', { required: 'Department name is required' })} />
            <TextField label="Description" multiline minRows={2} {...register('description')} />
            <Controller name="departmentHead" control={control} render={({ field }) => (
              <Autocomplete
                options={employeeOptions}
                loading={employeesQuery.isPending}
                value={employeeOptions.find((employee) => employee.id === field.value) ?? null}
                inputValue={employeeSearch}
                onInputChange={(_, value) => setEmployeeSearch(value)}
                onChange={(_, employee) => field.onChange(employee?.id ?? '')}
                getOptionLabel={(employee) => employee.fullName ?? ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Department head (employee record)" />}
              />
            )} />
            <TextField label="Location" {...register('location')} />
            {department && <Controller name="status" control={control} render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="department-status-label">Status</InputLabel>
                <Select {...field} labelId="department-status-label" label="Status">
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>
            )} />}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : department ? 'Save changes' : 'Create department'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
