import { useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

const conditions = ['NEW', 'EXCELLENT', 'GOOD', 'FAIR'];

export default function BorrowingCheckoutDialog({ open, borrowing, saving, onClose, onSubmit }) {
  const { control, handleSubmit, register, reset } = useForm({ defaultValues: { items: [] } });

  useEffect(() => {
    if (open) reset({ items: (borrowing?.items ?? []).map((item) => ({
      itemId: item._id,
      condition: item.checkoutCondition ?? item.asset?.condition ?? 'GOOD',
      accessories: item.checkoutAccessories?.join(', ') ?? '',
      notes: item.checkoutNotes ?? ''
    })) });
  }, [borrowing, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <form onSubmit={handleSubmit((values) => onSubmit({ items: values.items.map((item) => ({
        ...item,
        accessories: item.accessories ? item.accessories.split(',').map((value) => value.trim()).filter(Boolean) : []
      })) }))}>
        <DialogTitle>Check out {borrowing?.borrowingNumber}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ pt: 1 }}>{(borrowing?.items ?? []).map((item, index) => <Stack key={item._id} spacing={1.5}>
            <Typography fontWeight={700}>{item.assetIdSnapshot} · {item.assetNameSnapshot}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller name={`items.${index}.condition`} control={control} render={({ field }) => <FormControl fullWidth><InputLabel id={`checkout-condition-${item._id}`}>Condition at checkout</InputLabel><Select {...field} labelId={`checkout-condition-${item._id}`} label="Condition at checkout">{conditions.map((condition) => <MenuItem key={condition} value={condition}>{condition}</MenuItem>)}</Select></FormControl>} />
              <TextField fullWidth label="Accessories released" helperText="Separate items with commas" {...register(`items.${index}.accessories`)} />
            </Stack>
            <TextField label="Checkout notes" {...register(`items.${index}.notes`)} />
            <input type="hidden" {...register(`items.${index}.itemId`)} />
          </Stack>)}</Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Checking out…' : 'Confirm checkout'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
