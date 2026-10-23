import { Button, Container, Paper, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

export default function ForbiddenPage() {
  return (
    <Container maxWidth="sm" sx={{ py: 10 }}>
      <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Typography variant="h4" component="h1" fontWeight={700}>Access denied</Typography>
          <Typography color="text.secondary">Your IT role does not have permission to view this page.</Typography>
          <Button component={Link} to="/" variant="contained" sx={{ alignSelf: 'flex-start' }}>Return to dashboard</Button>
        </Stack>
      </Paper>
    </Container>
  );
}
