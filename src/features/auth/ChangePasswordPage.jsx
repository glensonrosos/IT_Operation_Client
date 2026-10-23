import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ChangePasswordPage() {
  const { changePassword, changePasswordError, isChangingPassword, user } = useAuth();
  const navigate = useNavigate();
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, getValues, formState: { errors } } = useForm();

  const submit = async (values) => {
    setSuccess(false);
    try {
      await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      setSuccess(true);
      navigate('/', { replace: true });
    } catch {
      setSuccess(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'grey.100', py: 4 }}>
      <Container maxWidth="xs">
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, border: 1, borderColor: 'divider' }}>
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit(submit)} noValidate>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={700}>Account security</Typography>
              <Typography variant="h5" component="h1" fontWeight={700}>Change your password</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>A new password is required before using the system.</Typography>
            </Box>
            {changePasswordError && <Alert severity="error">{changePasswordError.response?.data?.message ?? 'Unable to change password.'}</Alert>}
            {success && <Alert severity="success">Password changed successfully.</Alert>}
            <TextField label="Current password" type="password" autoComplete="current-password" error={Boolean(errors.currentPassword)} helperText={errors.currentPassword?.message} {...register('currentPassword', { required: 'Enter your current password' })} />
            <TextField label="New password" type="password" autoComplete="new-password" error={Boolean(errors.newPassword)} helperText={errors.newPassword?.message ?? 'Use at least 6 characters.'} {...register('newPassword', { required: 'Enter a new password', minLength: { value: 6, message: 'Use at least 6 characters' } })} />
            <TextField label="Confirm new password" type="password" autoComplete="new-password" error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} {...register('confirmPassword', { required: 'Confirm your new password', validate: (value) => value === getValues('newPassword') || 'Passwords do not match' })} />
            <Button type="submit" variant="contained" size="large" disabled={isChangingPassword || !user}>
              {isChangingPassword ? 'Saving…' : 'Update password'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
