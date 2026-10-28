import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Popper, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

function localDateTime(value) {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

function AssetOption({ asset, optionProps }) {
  const [hovered, setHovered] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const imageQuery = useQuery({
    queryKey: ['borrowable-asset-latest-image', asset.id],
    enabled: hovered,
    queryFn: async () => (await apiClient.get(`/assets/${asset.id}/images`)).data.data.images
  });
  const image = imageQuery.data?.[0];

  return (
    <Box component="li" {...optionProps} onMouseEnter={(event) => { setHovered(true); setAnchorEl(event.currentTarget); optionProps.onMouseEnter?.(event); }} onMouseLeave={() => { setHovered(false); setAnchorEl(null); }} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
      <Box sx={{ width: 52, height: 52, flexShrink: 0, position: 'relative', borderRadius: 1, bgcolor: 'grey.100', display: 'grid', placeItems: 'center' }}>
        {image ? <Box component="img" src={`/api/assets/${asset.id}/images/${image._id ?? image.id}`} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 1 }} /> : <Typography variant="caption" color="text.secondary" align="center">No image uploaded</Typography>}
      </Box>
      <Typography variant="body2">{asset.assetId} · {asset.assetName} ({asset.condition})</Typography>
      {image && <Popper open={hovered} placement="right-start" anchorEl={anchorEl} sx={{ zIndex: 1500, pointerEvents: 'none' }}>
        <Box sx={{ p: 0.75, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 6 }}>
          <Box component="img" src={`/api/assets/${asset.id}/images/${image._id ?? image.id}`} alt={`${asset.assetId} preview`} sx={{ display: 'block', width: 420, height: 420, objectFit: 'contain', bgcolor: 'grey.100', borderRadius: 1 }} />
        </Box>
      </Popper>}
    </Box>
  );
}

export default function BorrowingCreateDialog({ open, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({ defaultValues: { borrower: '', assets: [], requestReason: '', dueAt: '' } });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [conditionImages, setConditionImages] = useState([]);
  const selectedBorrower = useWatch({ control, name: 'borrower' });
  const search = useDebouncedValue(employeeSearch);
  const employeesQuery = useQuery({
    queryKey: ['borrowing-employees', search],
    enabled: open,
    queryFn: async () => (await apiClient.get('/employees', { params: { status: 'ACTIVE', ...(search ? { search } : {}), limit: 100 } })).data.data.items
  });
  const assetsQuery = useQuery({
    queryKey: ['borrowable-assets'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/assets', { params: { isBorrowable: 'true', limit: 100 } })).data.data.items
  });

  useEffect(() => {
    if (open) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      reset({ borrower: '', assets: [], requestReason: '', dueAt: localDateTime(tomorrow) });
    }
    setEmployeeSearch('');
    setSelectedEmployee(null);
    setConditionImages([]);
  }, [open, reset]);

  const employees = employeesQuery.data ?? [];
  const borrowableAssets = (assetsQuery.data ?? []).filter((asset) => ['AVAILABLE', 'IN_STOCK'].includes(asset.status) && asset.isBorrowable && !asset.currentCustodian && !asset.currentBorrower);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        borrower: values.borrower,
        assets: values.assets.map((asset) => asset.id),
        requestReason: values.requestReason,
        dueAt: new Date(values.dueAt).toISOString(),
        conditionImages
      }))}>
        <DialogTitle>Request equipment borrowing</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">IT staff records the request on behalf of the employee. Employees do not sign in.</Alert>
            {error && <Alert severity="error">{error}</Alert>}
            <Controller name="borrower" control={control} rules={{ required: 'Select an active employee' }} render={({ field }) => <Autocomplete
              options={employees}
              loading={employeesQuery.isFetching}
              value={selectedEmployee}
              inputValue={employeeSearch}
              onInputChange={(_, value) => setEmployeeSearch(value)}
              onChange={(_, employee) => { setSelectedEmployee(employee); setEmployeeSearch(employee ? `${employee.fullName} - ${employee.department?.departmentName ?? employee.departmentName ?? 'No department'}` : ''); field.onChange(employee?.id ?? ''); }}
              noOptionsText={employeesQuery.isError ? 'Unable to load employees' : search ? 'No matching active employees' : 'No active employees found'}
              getOptionLabel={(employee) => `${employee.fullName} - ${employee.department?.departmentName ?? employee.departmentName ?? 'No department'}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options, state) => options.filter((employee) => `${employee.fullName} ${employee.employeeId ?? ''} ${employee.department?.departmentName ?? employee.departmentName ?? ''}`.toLowerCase().includes(state.inputValue.toLowerCase())).slice(0, 10)}
              renderInput={(params) => <TextField {...params} label="Borrower" error={Boolean(errors.borrower)} helperText={errors.borrower?.message ?? 'Search by employee name or ID'} />}
            />} />
            {selectedBorrower && <Controller name="assets" control={control} rules={{ validate: (values) => values.length > 0 || 'Select at least one available borrowable asset' }} render={({ field }) => <Autocomplete
              multiple
              options={borrowableAssets}
              loading={assetsQuery.isFetching}
              value={borrowableAssets.filter((asset) => (field.value ?? []).some((selected) => selected.id === asset.id))}
              onChange={(_, selected) => field.onChange(selected)}
              getOptionLabel={(asset) => `${asset.assetId} · ${asset.assetName} (${asset.condition})`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              filterOptions={(options, state) => options.filter((asset) => `${asset.assetId} ${asset.assetName} ${asset.brand ?? ''} ${asset.model ?? ''} ${asset.condition ?? ''}`.toLowerCase().includes(state.inputValue.toLowerCase())).slice(0, 5)}
              renderOption={(props, asset) => <AssetOption key={asset.id} optionProps={props} asset={asset} />}
              renderInput={(params) => <TextField {...params} label="Equipment" error={Boolean(errors.assets)} helperText={errors.assets?.message ?? 'Only assets marked borrowable and currently available appear here.'} />}
            />} />}
            <TextField label="Request reason" multiline minRows={3} error={Boolean(errors.requestReason)} helperText={errors.requestReason?.message} {...register('requestReason', { required: 'Describe why the equipment is needed', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Due date and time" type="datetime-local" InputLabelProps={{ shrink: true }} error={Boolean(errors.dueAt)} {...register('dueAt', { required: 'Set a due date' })} />
            <Button component="label" variant="outlined">Upload checkout condition images<input hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setConditionImages(Array.from(event.target.files ?? []))} /></Button>
            {conditionImages.length > 0 && <Alert severity="info">{conditionImages.length} image(s) selected for checkout evidence.</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving || assetsQuery.isPending}>{saving ? 'Submitting…' : 'Submit request'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
