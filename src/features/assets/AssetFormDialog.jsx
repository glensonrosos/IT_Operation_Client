import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Tooltip, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField, LinearProgress } from '@mui/material';

const statuses = ['AVAILABLE', 'UNDER_REPAIR', 'DAMAGED', 'LOST', 'RETIRED', 'DISPOSED'];
const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE'];

function dateValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

export default function AssetFormDialog({ open, asset, types, employees, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm();
  const [images, setImages] = useState([]);
  const selectedType = watch('assetType');
  const activeTypes = types.filter((type) => type.isActive);
  const assetType = types.find((type) => type.id === selectedType);
  const hasCustodian = Boolean(asset?.currentCustodian);

  useEffect(() => {
    reset({
      assetType: asset?.assetType?.id ?? asset?.assetType?._id ?? '', assetName: asset?.assetName ?? '',
      brand: asset?.brand ?? '', model: asset?.model ?? '', serialNumber: asset?.serialNumber ?? '',
      purchaseDate: dateValue(asset?.purchaseDate), purchaseCost: asset?.purchaseCost ?? '',
      warrantyStart: dateValue(asset?.warrantyStart), warrantyEnd: dateValue(asset?.warrantyEnd),
      assignTo: asset?.currentCustodian?.id ?? asset?.currentCustodian?._id ?? '', accessories: '', location: asset?.location ?? '', status: asset?.status ?? 'AVAILABLE',
      condition: asset?.condition ?? 'GOOD', isBorrowable: asset?.isBorrowable ?? false, description: asset?.description ?? '', notes: asset?.notes ?? ''
    });
    setImages([]);
  }, [asset, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit((values) => onSubmit({
        ...values,
        images,
        purchaseCost: values.purchaseCost === '' ? '' : Number(values.purchaseCost),
        isBorrowable: hasCustodian ? false : Boolean(values.isBorrowable),
        serialNumber: values.serialNumber || ''
      }))}>
        <DialogTitle>{asset ? `Edit ${asset.assetId}` : 'Register asset'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <FormHelperText error>{error}</FormHelperText>}
            <Controller name="assetType" control={control} rules={{ required: 'Choose an asset type' }} render={({ field }) => <FormControl fullWidth error={Boolean(errors.assetType)}><InputLabel id="asset-type-label">Asset type</InputLabel><Select {...field} disabled={Boolean(asset)} labelId="asset-type-label" label="Asset type">{activeTypes.map((type) => <MenuItem key={type.id} value={type.id}>{type.name} ({type.code})</MenuItem>)}</Select>{errors.assetType && <FormHelperText>{errors.assetType.message}</FormHelperText>}</FormControl>} />
            {!asset && assetType && <FormHelperText>Generated asset ID format: IT-{assetType.code}-000001</FormHelperText>}
            <TextField label="Asset name" error={Boolean(errors.assetName)} helperText={errors.assetName?.message} {...register('assetName', { required: 'Asset name is required' })} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Brand" fullWidth {...register('brand')} />
              <TextField label="Model" fullWidth {...register('model')} />
              <TextField label="Serial number" fullWidth {...register('serialNumber')} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Purchase date" type="date" fullWidth InputLabelProps={{ shrink: true }} inputProps={{ max: new Date().toISOString().slice(0, 10) }} error={Boolean(errors.purchaseDate)} helperText={errors.purchaseDate?.message} {...register('purchaseDate', { validate: (value) => !value || new Date(`${value}T00:00:00`) <= new Date() || 'Purchase date cannot be in the future' })} />
              <TextField label="Purchase cost" type="number" fullWidth inputProps={{ min: 0, step: '0.01' }} {...register('purchaseCost')} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Warranty start" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register('warrantyStart')} />
              <TextField label="Warranty end" type="date" fullWidth InputLabelProps={{ shrink: true }} {...register('warrantyEnd')} />
              <TextField label="Location" fullWidth {...register('location')} />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller name="assignTo" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="asset-custodian-label">Assign to employee</InputLabel><Select {...field} disabled={Boolean(asset?.currentCustodian)} labelId="asset-custodian-label" label="Assign to employee"><MenuItem value="">Unassigned</MenuItem>{(employees ?? []).filter((employee) => employee.status === 'ACTIVE').map((employee) => <MenuItem key={employee.id} value={employee.id}>{employee.fullName} - {employee.department?.departmentName ?? 'No department'}</MenuItem>)}</Select></FormControl>} />
              {!asset && <TextField fullWidth label="Accessories" helperText="Separate accessories with commas" {...register('accessories')} />}
              {asset && <Controller name="status" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="asset-status-label">Status</InputLabel><Select {...field} labelId="asset-status-label" label="Status">{statuses.map((status) => <MenuItem key={status} value={status} disabled={['ASSIGNED', 'IN_USE', 'BORROWED'].includes(status)}>{status.replaceAll('_', ' ')}</MenuItem>)}</Select></FormControl>} />}
              <Controller name="condition" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="asset-condition-label">Condition</InputLabel><Select {...field} labelId="asset-condition-label" label="Condition">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />
            </Stack>
            <Controller name="isBorrowable" control={control} render={({ field }) => <FormControlLabel control={<Checkbox checked={hasCustodian ? false : Boolean(field.value)} onChange={(_, checked) => field.onChange(checked)} disabled={hasCustodian} />} label={<Tooltip title="Assets without a custodian are treated as IT Department stock and can be made available for borrowing."><span>Available for tool and equipment borrowing</span></Tooltip>} />} />
            <Stack spacing={1}><Button variant="outlined" component="label">Add asset images<input hidden type="file" accept="image/jpeg,image/png" multiple onChange={(event) => setImages(Array.from(event.target.files ?? []))} /></Button>{images.length > 0 && <FormHelperText>{images.length} image{images.length === 1 ? '' : 's'} selected: {images.map((image) => image.name).join(', ')}</FormHelperText>}</Stack>
            <TextField label="Description" multiline minRows={2} {...register('description')} />
            <TextField label="Notes" multiline minRows={2} {...register('notes')} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, position: 'relative' }}>{saving && <LinearProgress sx={{ position: 'absolute', left: 0, right: 0, top: 0 }} />}<Button onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" variant="contained" disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}>{saving ? (images.length ? 'Uploading images…' : 'Saving…') : asset ? 'Save changes' : 'Register asset'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
