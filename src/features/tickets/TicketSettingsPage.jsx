import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Add, ArchiveOutlined, EditOutlined, HelpOutline, RestoreOutlined } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, IconButton, InputLabel, MenuItem, Paper, Select, Snackbar, Stack, Switch, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';

function getErrorMessage(error) {
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

function CategoryDialog({ open, category, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset } = useForm();
  useEffect(() => reset({ name: category?.name ?? '', description: category?.description ?? '' }), [category, open, reset]);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{category ? 'Edit ticket category' : 'Add ticket category'}</DialogTitle>
        <DialogContent dividers><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}<TextField label="Category name" required {...register('name', { required: 'Category name is required' })} /><TextField label="Description" multiline minRows={3} {...register('description')} /></Stack></DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save category'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}

function SlaDialog({ open, policy, saving, error, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control } = useForm();
  useEffect(() => reset({
    resolutionTargetHours: policy?.resolutionTargetHours ?? 24,
    responseTargetMinutes: policy?.responseTargetMinutes ?? '',
    riskThresholdPercent: policy?.riskThresholdPercent ?? 20,
    isActive: policy?.isActive ?? true
  }), [policy, open, reset]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        resolutionTargetHours: Number(values.resolutionTargetHours),
        responseTargetMinutes: values.responseTargetMinutes === '' ? null : Number(values.responseTargetMinutes),
        riskThresholdPercent: Number(values.riskThresholdPercent),
        isActive: values.isActive
      }))}>
        <DialogTitle>Edit {policy?.priority} SLA policy</DialogTitle>
        <DialogContent dividers><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}
          <TextField label="Resolution target (hours)" type="number" inputProps={{ min: 1, max: 8760 }} required {...register('resolutionTargetHours', { required: true, min: 1, max: 8760 })} />
          <TextField label="Response target (minutes)" type="number" inputProps={{ min: 1, max: 525600 }} helperText="Leave blank to disable response-time SLA" {...register('responseTargetMinutes')} />
          <TextField label="At-risk threshold (% remaining)" type="number" inputProps={{ min: 1, max: 100 }} required {...register('riskThresholdPercent', { required: true, min: 1, max: 100 })} />
          <Controller name="isActive" control={control} render={({ field }) => <FormControlLabel control={<Switch checked={Boolean(field.value)} onChange={(_, checked) => field.onChange(checked)} />} label="Policy active" />} />
        </Stack></DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save policy'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}

export default function TicketSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManageCategories = can(user, 'ticketCategories.manage');
  const canManageSla = can(user, 'sla.manage');
  const [tab, setTab] = useState(canManageCategories ? 0 : 1);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryError, setCategoryError] = useState('');
  const [slaDialog, setSlaDialog] = useState(false);
  const [slaHelpOpen, setSlaHelpOpen] = useState(false);
  const [editingSla, setEditingSla] = useState(null);
  const [slaError, setSlaError] = useState('');
  const [confirmCategory, setConfirmCategory] = useState(null);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories', 'all'],
    enabled: canManageCategories,
    queryFn: async () => (await apiClient.get('/ticket-categories', { params: { includeArchived: 'true' } })).data.data.items
  });
  const slaQuery = useQuery({
    queryKey: ['sla-policies'],
    enabled: canManageSla,
    queryFn: async () => (await apiClient.get('/sla-policies')).data.data.items
  });
  const categoryMutation = useMutation({
    mutationFn: ({ id, values }) => id ? apiClient.patch(`/ticket-categories/${id}`, values) : apiClient.post('/ticket-categories', values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['ticket-categories'] }); setCategoryDialog(false); setEditingCategory(null); setCategoryError(''); setNotice({ open: true, message: 'Ticket category saved.', severity: 'success' }); },
    onError: (error) => setCategoryError(getErrorMessage(error))
  });
  const categoryStateMutation = useMutation({
    mutationFn: ({ category, restore }) => restore
      ? apiClient.post(`/ticket-categories/${category.id}/restore`)
      : category.isArchived
        ? apiClient.patch(`/ticket-categories/${category.id}`, { isActive: !category.isActive })
        : apiClient.post(`/ticket-categories/${category.id}/archive`),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['ticket-categories'] }); setConfirmCategory(null); setNotice({ open: true, message: 'Category status updated.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: getErrorMessage(error), severity: 'error' })
  });
  const slaMutation = useMutation({
    mutationFn: ({ policy, values }) => apiClient.patch(`/sla-policies/${policy.priority}`, values),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['sla-policies'] }); setSlaDialog(false); setEditingSla(null); setSlaError(''); setNotice({ open: true, message: 'SLA policy saved. Existing tickets retain their current SLA snapshot.', severity: 'success' }); },
    onError: (error) => setSlaError(getErrorMessage(error))
  });

  const submitCategory = (values) => categoryMutation.mutate({ id: editingCategory?.id, values });
  const submitSla = (values) => slaMutation.mutate({ policy: editingSla, values });
  const categories = categoriesQuery.data ?? [];
  const policies = slaQuery.data ?? [];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Box><Typography variant="overline" color="primary.main" fontWeight={700}>Service Desk</Typography><Typography variant="h4" component="h1" fontWeight={700}>Ticket configuration</Typography><Typography color="text.secondary">Manage categories and priority-based SLA targets.</Typography></Box>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)}><Tab label="Categories" disabled={!canManageCategories} /><Tab label="SLA policies" disabled={!canManageSla} /></Tabs>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {tab === 0 && <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6" fontWeight={700}>Ticket categories</Typography><Button startIcon={<Add />} variant="contained" onClick={() => { setCategoryError(''); setEditingCategory(null); setCategoryDialog(true); }}>Add category</Button></Stack>
                {categoriesQuery.isError && <Alert severity="error">{getErrorMessage(categoriesQuery.error)}</Alert>}
                <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Category</TableCell><TableCell>Description</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
                  {categoriesQuery.isPending ? <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell></TableRow> : categories.map((category) => <TableRow key={category.id}><TableCell>{category.name}</TableCell><TableCell>{category.description || '—'}</TableCell><TableCell><Chip size="small" label={category.isArchived ? 'ARCHIVED' : category.isActive ? 'ACTIVE' : 'INACTIVE'} color={category.isArchived ? 'default' : category.isActive ? 'success' : 'warning'} /></TableCell><TableCell align="right"><Stack direction="row" justifyContent="flex-end"><Button size="small" startIcon={<EditOutlined />} disabled={category.isArchived} onClick={() => { setEditingCategory(category); setCategoryError(''); setCategoryDialog(true); }}>Edit</Button>{category.isArchived ? <Button size="small" startIcon={<RestoreOutlined />} onClick={() => categoryStateMutation.mutate({ category, restore: true })}>Restore</Button> : category.isActive ? <Button size="small" color="warning" startIcon={<ArchiveOutlined />} onClick={() => setConfirmCategory(category)}>Archive</Button> : <Button size="small" onClick={() => categoryStateMutation.mutate({ category, restore: false })}>Activate</Button>}</Stack></TableCell></TableRow>)}
                </TableBody></Table></TableContainer>
              </Stack>}
              {tab === 1 && <Stack spacing={2}>
                <Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6" fontWeight={700}>Service-level targets</Typography><IconButton size="small" onClick={() => setSlaHelpOpen(true)} aria-label="How SLA policies work"><HelpOutline fontSize="small" /></IconButton></Stack>
                {slaQuery.isError && <Alert severity="error">{getErrorMessage(slaQuery.error)}</Alert>}
                <TableContainer><Table><TableHead><TableRow><TableCell>Priority</TableCell><TableCell>Resolution target</TableCell><TableCell>Response target</TableCell><TableCell>At-risk threshold</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead><TableBody>
                  {slaQuery.isPending ? <TableRow><TableCell colSpan={6} align="center"><CircularProgress size={24} /></TableCell></TableRow> : policies.map((policy) => <TableRow key={policy.priority}><TableCell><Chip size="small" label={policy.priority} color={policy.priority === 'CRITICAL' ? 'error' : policy.priority === 'HIGH' ? 'warning' : 'default'} /></TableCell><TableCell>{policy.resolutionTargetHours} hours</TableCell><TableCell>{policy.responseTargetMinutes ? `${policy.responseTargetMinutes} minutes` : 'Not configured'}</TableCell><TableCell>{policy.riskThresholdPercent}%</TableCell><TableCell>{policy.isActive ? 'Active' : 'Inactive'}</TableCell><TableCell align="right"><Button size="small" startIcon={<EditOutlined />} onClick={() => { setEditingSla(policy); setSlaError(''); setSlaDialog(true); }}>Edit</Button></TableCell></TableRow>)}
                </TableBody></Table></TableContainer>
                <Alert severity="info">SLA timers currently use elapsed calendar hours. Changes apply to new tickets and tickets whose priority is changed; existing ticket deadlines remain snapshotted.</Alert>
              </Stack>}
            </Box>
          </Paper>
        </Stack>
      </Container>
      <CategoryDialog open={categoryDialog} category={editingCategory} saving={categoryMutation.isPending} error={categoryError} onClose={() => setCategoryDialog(false)} onSubmit={submitCategory} />
      <Dialog open={slaHelpOpen} onClose={() => setSlaHelpOpen(false)} fullWidth maxWidth="sm"><DialogTitle>How SLA policies work</DialogTitle><DialogContent><Stack spacing={2}><Typography><strong>Resolution target</strong> — the number of calendar hours allowed to resolve or close a ticket before it becomes <strong>BREACHED</strong>.</Typography><Typography><strong>Response target</strong> — the number of minutes allowed for the first response to the requester. Leave blank to ignore response-time SLA.</Typography><Typography><strong>At-risk threshold</strong> — when the remaining time drops to this percentage of the target, the ticket becomes <strong>AT_RISK</strong>.</Typography><Typography><strong>Policy active</strong> — inactive policies are not applied to new tickets or priority changes.</Typography><Alert severity="info">SLA timers use elapsed calendar hours. Changes apply to new tickets and to tickets whose priority is changed; existing ticket deadlines remain snapshotted.</Alert></Stack></DialogContent><DialogActions><Button onClick={() => setSlaHelpOpen(false)}>Close</Button></DialogActions></Dialog>
      <SlaDialog open={slaDialog} policy={editingSla} saving={slaMutation.isPending} error={slaError} onClose={() => setSlaDialog(false)} onSubmit={submitSla} />
      <Dialog open={Boolean(confirmCategory)} onClose={() => setConfirmCategory(null)}><DialogTitle>Archive category?</DialogTitle><DialogContent>{confirmCategory?.name} will no longer be available for new tickets; existing tickets keep their category snapshot.</DialogContent><DialogActions><Button onClick={() => setConfirmCategory(null)}>Cancel</Button><Button color="warning" onClick={() => categoryStateMutation.mutate({ category: confirmCategory, restore: false })}>Archive</Button></DialogActions></Dialog>
      <Snackbar open={notice.open} autoHideDuration={5000} onClose={() => setNotice((current) => ({ ...current, open: false }))}><Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))}>{notice.message}</Alert></Snackbar>
    </Box>
  );
}
