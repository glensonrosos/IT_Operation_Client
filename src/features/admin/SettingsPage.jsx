import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Container, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';

const shrinkLabel = { shrink: true };

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['settings'], queryFn: async () => (await apiClient.get('/settings')).data.data.settings });
  const { register, control, handleSubmit, reset } = useForm({ defaultValues: { lowStockAlertEnabled: true } });

  useEffect(() => {
    if (query.data) reset(query.data);
  }, [query.data, reset]);

  const mutation = useMutation({
    mutationFn: (values) => apiClient.patch('/settings', { ...values, warrantyAlertDays: Number(values.warrantyAlertDays), borrowingDefaultDays: Number(values.borrowingDefaultDays) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] })
  });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper sx={{ p: { xs: 2.5, md: 4 } }}>
          <Stack spacing={3}>
            <Box><Typography variant="overline" color="primary.main">Administration</Typography><Typography variant="h4" fontWeight={700}>System settings</Typography><Typography color="text.secondary">Operational defaults only. Secrets remain in environment configuration.</Typography></Box>
            {mutation.isSuccess && <Alert>Settings saved.</Alert>}
            {mutation.isError && <Alert severity="error">Unable to save settings.</Alert>}
            <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
              <Stack spacing={2.5}>
                <TextField label="Company name" InputLabelProps={shrinkLabel} {...register('companyName')} />
                <TextField label="Company timezone" helperText="IANA timezone, for example Asia/Manila" InputLabelProps={shrinkLabel} {...register('companyTimezone')} />
                <TextField label="IT support email" type="email" InputLabelProps={shrinkLabel} {...register('supportEmail')} />
                <TextField label="Warranty alert days" type="number" InputLabelProps={shrinkLabel} {...register('warrantyAlertDays')} />
                <TextField label="Default borrowing days" type="number" InputLabelProps={shrinkLabel} {...register('borrowingDefaultDays')} />
                <Controller name="lowStockAlertEnabled" control={control} render={({ field }) => <Stack direction="row" alignItems="center"><Switch checked={Boolean(field.value)} onChange={(_, value) => field.onChange(value)} /><Typography>Enable low-stock alerts</Typography></Stack>} />
                <Button type="submit" variant="contained" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save settings'}</Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
