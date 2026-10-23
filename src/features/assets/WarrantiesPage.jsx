import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Container, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';

export default function WarrantiesPage() {
  const [days, setDays] = useState(30);
  const [includeExpired, setIncludeExpired] = useState(false);
  const params = { days, includeExpired: includeExpired ? 'true' : 'false' };
  const query = useQuery({ queryKey: ['warranties', params], queryFn: async () => (await apiClient.get('/warranties', { params })).data.data.items });

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box><Typography variant="overline" color="primary.main" fontWeight={700}>Asset Management</Typography><Typography variant="h4" component="h1" fontWeight={700}>Warranty watch</Typography><Typography color="text.secondary">Review warranties expiring soon and assets with expired coverage.</Typography></Box>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="warranty-window-label">Expiring within</InputLabel><Select labelId="warranty-window-label" label="Expiring within" value={days} onChange={(event) => setDays(event.target.value)}>{[30, 60, 90, 180, 365].map((value) => <MenuItem key={value} value={value}>{value} days</MenuItem>)}</Select></FormControl>
            <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel id="warranty-expired-label">Coverage</InputLabel><Select labelId="warranty-expired-label" label="Coverage" value={includeExpired ? 'include' : 'current'} onChange={(event) => setIncludeExpired(event.target.value === 'include')}><MenuItem value="current">Current coverage only</MenuItem><MenuItem value="include">Include expired</MenuItem></Select></FormControl>
          </Stack></Paper>
          {query.isError && <Alert severity="error">{query.error?.response?.data?.message ?? 'Unable to load warranty records.'}</Alert>}
          <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}><Table><TableHead><TableRow><TableCell>Asset</TableCell><TableCell>Type</TableCell><TableCell>Department</TableCell><TableCell>Custodian / Borrower</TableCell><TableCell>Vendor</TableCell><TableCell>Coverage ends</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>
            {query.isPending ? <TableRow><TableCell colSpan={7} align="center">Loading warranty records…</TableCell></TableRow> : (query.data ?? []).length === 0 ? <TableRow><TableCell colSpan={7} align="center">No warranties match this window.</TableCell></TableRow> : query.data.map((asset) => <TableRow hover key={asset.id}><TableCell><Button component={Link} to={`/assets/${asset.id}`} size="small">{asset.assetId} · {asset.assetName}</Button></TableCell><TableCell>{asset.assetType?.name ?? asset.assetTypeCode}</TableCell><TableCell>{asset.department?.departmentName ?? '—'}</TableCell><TableCell>{asset.currentCustodian?.fullName ?? asset.currentBorrower?.fullName ?? '—'}</TableCell><TableCell>{asset.vendor || '—'}</TableCell><TableCell>{new Date(asset.warrantyEnd).toLocaleDateString()}</TableCell><TableCell><Chip size="small" label={asset.warrantyStatus === 'EXPIRED' ? 'EXPIRED' : 'EXPIRING SOON'} color={asset.warrantyStatus === 'EXPIRED' ? 'error' : 'warning'} /></TableCell></TableRow>)}
          </TableBody></Table></TableContainer>
        </Stack>
      </Container>
    </Box>
  );
}
