import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Container, Grid, Paper, Stack, Typography } from '@mui/material';
import { Download } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';

function MetricCard({ label, value, tone = 'primary' }) {
  return <Card variant="outlined"><CardContent><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4" color={`${tone}.main`} fontWeight={700}>{value}</Typography></CardContent></Card>;
}

function Bars({ title, rows }) {
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <Paper variant="outlined" sx={{ p: 2.5 }}><Typography variant="h6" fontWeight={700} gutterBottom>{title}</Typography><Stack spacing={1.5}>{rows.filter((row) => row.count > 0).map((row) => <Box key={row.key}><Stack direction="row" justifyContent="space-between"><Typography variant="body2">{row.key.replaceAll('_', ' ')}</Typography><Typography variant="body2" fontWeight={700}>{row.count}</Typography></Stack><Box sx={{ height: 8, bgcolor: 'grey.200', borderRadius: 1 }}><Box sx={{ height: '100%', width: `${(row.count / max) * 100}%`, bgcolor: 'primary.main', borderRadius: 1 }} /></Box></Box>)}{rows.every((row) => row.count === 0) && <Typography color="text.secondary">No data available.</Typography>}</Stack></Paper>;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['dashboard-report'], queryFn: async () => (await apiClient.get('/reports/dashboard')).data.data, refetchInterval: 60_000 });
  if (query.isPending) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}><DirectoryNavigation /><Container maxWidth="xl" sx={{ py: 4 }}><Stack spacing={3}><Box><Typography variant="overline" color="primary.main" fontWeight={700}>Operations</Typography><Typography variant="h4" fontWeight={700}>Reports & dashboard</Typography><Typography color="text.secondary">Permission-aware operational KPIs from the current IT records.</Typography></Box>{can(user, 'reports.export') && <Stack direction="row" spacing={1} flexWrap="wrap">{['assets', 'tickets', 'borrowings', 'maintenance'].map((type) => <Button key={type} size="small" variant="outlined" startIcon={<Download />} component="a" href={`/api/reports/export/${type}.csv`}>{type} CSV</Button>)}</Stack>}{query.isError ? <Alert severity="error">{query.error?.response?.data?.message ?? 'Unable to load report data.'}</Alert> : <><Grid container spacing={2}>{[['Open tickets', query.data.kpis.ticketsOpen], ['Overdue tickets', query.data.kpis.ticketsOverdue, 'error'], ['Active borrowings', query.data.kpis.borrowingsActive], ['Overdue borrowings', query.data.kpis.borrowingsOverdue, 'error'], ['Assigned assets', query.data.kpis.assetsAssigned], ['Borrowed assets', query.data.kpis.assetsBorrowed], ['Repair queue', query.data.kpis.assetsRepair, 'warning'], ['Open maintenance', query.data.kpis.maintenanceOpen, 'warning'], ['Warranty expiring', query.data.kpis.warrantyExpiring, 'warning']].map(([label, value, tone]) => <Grid item xs={12} sm={6} md={4} lg={3} key={label}><MetricCard label={label} value={value} tone={tone} /></Grid>)}</Grid><Grid container spacing={2}><Grid item xs={12} md={6}><Bars title="Tickets by status" rows={query.data.ticketStatus} /></Grid><Grid item xs={12} md={6}><Bars title="Assets by status" rows={query.data.assetStatus} /></Grid><Grid item xs={12} md={6}><Bars title="Borrowings by status" rows={query.data.borrowingStatus} /></Grid><Grid item xs={12} md={6}><Bars title="Maintenance by status" rows={query.data.maintenanceStatus} /></Grid></Grid></>}</Stack></Container></Box>;
}
