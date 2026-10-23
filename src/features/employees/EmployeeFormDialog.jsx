import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';

const statuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'RESIGNED', 'TERMINATED', 'RETIRED'];

export default function EmployeeFormDialog({ open, employee, departments, saving, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const activeDepartments = departments.filter((department) => department.status === 'ACTIVE');
  const currentDepartment = employee?.department ? {
    ...employee.department,
    id: employee.department.id ?? employee.department._id
  } : null;
  const departmentOptions = [...activeDepartments];
  if (currentDepartment && !departmentOptions.some((department) => department.id === currentDepartment.id)) departmentOptions.unshift(currentDepartment);

  useEffect(() => {
    reset({
      firstName: employee?.firstName ?? '', lastName: employee?.lastName ?? '', department: employee?.department?._id ?? employee?.department?.id ?? '',
      position: employee?.position ?? '', email: employee?.email ?? '',
      location: employee?.location ?? '', notes: employee?.notes ?? '', status: employee?.status ?? 'ACTIVE'
    });
  }, [employee, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{employee ? 'Edit employee record' : 'Add employee'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="First name" error={Boolean(errors.firstName)} helperText={errors.firstName?.message} {...register('firstName', { required: 'First name is required' })} />
            <TextField label="Last name" error={Boolean(errors.lastName)} helperText={errors.lastName?.message} {...register('lastName', { required: 'Last name is required' })} />
            <Controller name="department" control={control} rules={{ required: 'Department is required' }} render={({ field }) => (
              <FormControl fullWidth error={Boolean(errors.department)}>
                <InputLabel id="employee-department-label">Department</InputLabel>
                <Select {...field} labelId="employee-department-label" label="Department">
                  {departmentOptions.map((department) => <MenuItem key={department.id} value={department.id}>{department.departmentName}{department.status === 'INACTIVE' ? ' (inactive)' : ''}</MenuItem>)}
                </Select>
              </FormControl>
            )} />
            <TextField label="Position" {...register('position')} />
            <TextField label="Email" type="email" {...register('email')} />
            <TextField label="Location" fullWidth {...register('location')} />
            {employee && <Controller name="status" control={control} render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="employee-status-label">Employment status</InputLabel>
                <Select {...field} labelId="employee-status-label" label="Employment status">
                  {statuses.map((status) => <MenuItem key={status} value={status}>{status.replaceAll('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>
            )} />}
            <TextField label="Notes" multiline minRows={3} {...register('notes')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : employee ? 'Save changes' : 'Create employee'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
