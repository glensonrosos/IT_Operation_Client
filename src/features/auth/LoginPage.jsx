import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

function getErrorMessage(error) {
  return error?.response?.data?.message ?? 'Unable to sign in. Check your details and try again.';
}

export default function LoginPage() {
  const { user, login, isLoggingIn } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { username: '', password: '' } });

  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />;

  const submit = async (values) => {
    setFormError('');
    try {
      const signedInUser = await login(values);
      const destination = signedInUser.mustChangePassword ? '/change-password' : '/tickets';
      navigate(destination, { replace: true });
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: 'grey.100', py: 4 }}>
      <Container maxWidth="xs">
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, border: 1, borderColor: 'divider' }}>
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit(submit)} noValidate>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={700}>Internal IT Operations</Typography>
              <Typography variant="h4" component="h1" fontWeight={700}>Sign in</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>For authorized IT personnel only.</Typography>
            </Box>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Username or email"
              autoComplete="username"
              autoFocus
              fullWidth
              error={Boolean(errors.username)}
              helperText={errors.username?.message}
              {...register('username', { required: 'Enter your username or email' })}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              fullWidth
              error={Boolean(errors.password)}
              helperText={errors.password?.message}
              {...register('password', { required: 'Enter your password' })}
            />
            <Button type="submit" variant="contained" size="large" disabled={isLoggingIn}>
              {isLoggingIn ? 'Signing in…' : 'Sign in'}
            </Button>
            <Button component={Link} to="/live-ticket-board" variant="outlined" size="large">View live ticket board</Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
