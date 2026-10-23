import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography, MenuItem, Select, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import MaintenanceCompleteDialog from './MaintenanceCompleteDialog.jsx';
import MaintenanceCreateDialog from './MaintenanceCreateDialog.jsx';

function message(error) {
  return error?.response?.data?.message ?? 'The maintenance operation could not be completed.';
}

export default function AssetMaintenancePanel({ asset }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [completeRecord, setCompleteRecord] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [notice, setNotice] = useState({ open: false, text: '', severity: 'success' });
  const [notesDraft, setNotesDraft] = useState({});
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedule, setSchedule] = useState({ title: '', description: '', startsAt: '', frequency: 'WEEKLY', priority: 'MEDIUM' });

  const maintenanceQuery = useQuery({
    queryKey: ['asset-maintenance', asset.id],
    queryFn: async () => (await apiClient.get('/maintenance', { params: { asset: asset._id, limit: 100 } })).data.data.items
  });
  const invalidate = async () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['asset-maintenance', asset.id] }),
    queryClient.invalidateQueries({ queryKey: ['asset'] }),
    queryClient.invalidateQueries({ queryKey: ['assets'] }),
    queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
    queryClient.invalidateQueries({ queryKey: ['warranties'] })
  ]);
  const mutation = useMutation({
    mutationFn: ({ path, body }) => apiClient.post(path, body),
    onSuccess: async (response) => {
      await invalidate();
      setCreateOpen(false);
      setCompleteRecord(null);
      setNotice({ open: true, text: response.data.message ?? 'Maintenance record updated.', severity: 'success' });
    },
    onError: (error) => setNotice({ open: true, text: message(error), severity: 'error' })
  });
  const notesMutation = useMutation({
    mutationFn: ({ id, notes }) => apiClient.patch(`/maintenance/${id}/notes`, { notes }),
    onSuccess: async () => { await invalidate(); setNotice({ open: true, text: 'Notes saved successfully.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, text: message(error), severity: 'error' })
  });
  const canUpdate = can(user, 'maintenance.update');
  const records = maintenanceQuery.data ?? [];
  const [showSchedules, setShowSchedules] = useState(true);
  const [schedulePage, setSchedulePage] = useState(0);
  const [maintenancePage, setMaintenancePage] = useState(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState(10);
  const scheduleQuery = useQuery({ queryKey: ['asset-maintenance-schedules', asset.id], queryFn: async () => (await apiClient.get('/maintenance-schedules', { params: { asset: asset._id } })).data.data.schedules,  });
  const schedules = scheduleQuery.data ?? [];
  const scheduleStatusMutation = useMutation({ mutationFn: ({ id, status }) => apiClient.patch(`/maintenance-schedules/${id}`, { status }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['asset-maintenance-schedules', asset.id] }); await queryClient.invalidateQueries({ queryKey: ['asset-history', asset.id] }); setNotice({ open: true, text: 'Routine schedule status updated.', severity: 'success' }); }, onError: (error) => setNotice({ open: true, text: message(error), severity: 'error' }) });
  const scheduleMutation = useMutation({ mutationFn: () => apiClient.post('/maintenance-schedules', { ...schedule, asset: asset._id, startsAt: new Date(schedule.startsAt).toISOString() }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['asset-maintenance-schedules', asset.id] }); setScheduleOpen(false); setNotice({ open: true, text: 'Routine maintenance schedule saved.', severity: 'success' }); }, onError: (error) => setNotice({ open: true, text: message(error), severity: 'error' }) });

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup value={showSchedules ? 'schedules' : 'logs'} exclusive onChange={(_, value) => { if (value) setShowSchedules(value === 'schedules'); }} size="small" sx={{ alignSelf: 'flex-start', bgcolor: 'background.paper' }}><ToggleButton value="schedules" sx={{ px: 2, fontWeight: 700 }}>Routine schedules ({schedules.length})</ToggleButton><ToggleButton value="logs" sx={{ px: 2, fontWeight: 700 }}>Log maintenance</ToggleButton></ToggleButtonGroup>
      {showSchedules ? <Paper variant="outlined" sx={{ p: 2 }}><Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}><Typography variant="h6" gutterBottom>Routine maintenance schedules</Typography>{can(user, 'maintenance.create') && !asset.currentMaintenance && !asset.currentBorrowing && <Button variant="contained" onClick={() => setScheduleOpen(true)}>Add routine schedule</Button>}</Stack>{schedules.length === 0 ? <Typography color="text.secondary">No routine schedules.</Typography> : <><Table size="small"><TableHead><TableRow><TableCell>Record</TableCell><TableCell>Title</TableCell><TableCell>Maintenance plan</TableCell><TableCell>Frequency</TableCell><TableCell>Next run</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>{schedules.slice(schedulePage * tableRowsPerPage, schedulePage * tableRowsPerPage + tableRowsPerPage).map((item) => <TableRow key={item.id}><TableCell>{item.scheduleNumber || item.id}</TableCell><TableCell>{item.title}</TableCell><TableCell sx={{ maxWidth: 280, whiteSpace: 'pre-line' }}>{item.description || '�'}</TableCell><TableCell>{item.frequency.replaceAll('_', ' ')}</TableCell><TableCell>{new Date(item.nextRunAt).toLocaleString()}</TableCell><TableCell><Chip size="small" label={item.status ?? (item.isActive ? 'ACTIVE' : 'PAUSED')} color={(item.status ?? (item.isActive ? 'ACTIVE' : 'PAUSED')) === 'ACTIVE' ? 'success' : (item.status ?? '') === 'CANCELLED' ? 'default' : 'warning'} /></TableCell><TableCell><Stack direction="row" spacing={1}>{item.status !== 'CANCELLED' && <Button size="small" variant='outlined' onClick={() => scheduleStatusMutation.mutate({ id: item.id, status: item.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' })}>{item.status === 'PAUSED' ? 'Resume' : 'Pause'}</Button>}{item.status !== 'CANCELLED' && <Button variant='outlined' size="small" color="error" onClick={() => { if (window.confirm('Are you sure you want to cancel this routine maintenance schedule? It will stop future tickets and cannot be resumed.')) scheduleStatusMutation.mutate({ id: item.id, status: 'CANCELLED' }); }}>Cancel</Button>}</Stack></TableCell></TableRow>)}</TableBody></Table><TablePagination component="div" count={schedules.length} page={schedulePage} onPageChange={(_, nextPage) => setSchedulePage(nextPage)} rowsPerPage={tableRowsPerPage} onRowsPerPageChange={(event) => { setTableRowsPerPage(Number(event.target.value)); setSchedulePage(0); setMaintenancePage(0); }} rowsPerPageOptions={[5, 10, 25]} /></>}</Paper> : null}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2}>
        <Box><Typography variant="h6" fontWeight={700}>Maintenance history</Typography><Typography variant="body2" color="text.secondary">Record inspections, repairs, vendor work, costs, and next service dates.</Typography></Box>
        {can(user, 'maintenance.create') && !asset.currentMaintenance && !asset.currentBorrowing && <Stack direction="row" spacing={1}><Button variant={showSchedules ? 'outlined' : 'contained'} onClick={() => { if (showSchedules) setShowSchedules(false); else setCreateOpen(true); }}>Log maintenance</Button></Stack>}
      </Stack>
      {asset.currentMaintenance && <Alert severity="warning">A maintenance operation is open for this asset.</Alert>}
      {maintenanceQuery.isError && <Alert severity="error">{message(maintenanceQuery.error)}</Alert>}
      {maintenanceQuery.isPending ? <Typography color="text.secondary">Loading maintenance history…</Typography> : records.length === 0 ? <Typography color="text.secondary">No maintenance records.</Typography> : <><Table size="small"><TableHead><TableRow><TableCell>Record</TableCell><TableCell>Type</TableCell><TableCell>Title</TableCell><TableCell>Status</TableCell><TableCell>Reported</TableCell><TableCell>Vendor</TableCell><TableCell>Notes</TableCell><TableCell>Actions</TableCell></TableRow></TableHead><TableBody>{records.slice(maintenancePage * tableRowsPerPage, maintenancePage * tableRowsPerPage + tableRowsPerPage).map((record) => <TableRow key={record.id} hover onClick={() => record.status === 'COMPLETED' && setViewRecord(record)} sx={record.status === 'COMPLETED' ? { cursor: 'pointer' } : undefined}>
        <TableCell>{record.maintenanceNumber}</TableCell><TableCell>{record.type}</TableCell><TableCell>{record.title}</TableCell><TableCell><Chip size="small" label={(record.status === 'WAITING_VENDOR' ? 'ON_HOLD' : record.status ?? 'UNKNOWN').replaceAll('_', ' ')} color={record.status === 'COMPLETED' ? 'success' : record.status === 'CANCELLED' ? 'default' : ['ON_HOLD', 'WAITING_VENDOR'].includes(record.status) ? 'info' : 'warning'} /></TableCell><TableCell>{new Date(record.reportedAt).toLocaleDateString()}</TableCell><TableCell>{record.vendor || '—'}</TableCell><TableCell>{['COMPLETED', 'CANCELLED'].includes(record.status) ? (record.notes || '—') : <Stack spacing={1} sx={{ minWidth: 220 }}><TextField size="small" fullWidth multiline minRows={2} value={notesDraft[record.id] ?? record.notes ?? ''} onChange={(event) => setNotesDraft((current) => ({ ...current, [record.id]: event.target.value }))} placeholder="Add notes" /><Button size="small" variant="contained" sx={{ alignSelf: 'flex-end' }} onClick={() => notesMutation.mutate({ id: record.id, notes: notesDraft[record.id] ?? record.notes ?? '' })} disabled={!canUpdate || notesMutation.isPending}>{notesMutation.isPending ? 'Saving…' : 'Save notes'}</Button></Stack>}</TableCell><TableCell><Stack direction="row">
          {canUpdate && record.status === 'IN_PROGRESS' && <><Button size="small" onClick={() => mutation.mutate({ path: `/maintenance/${record.id}/waiting-vendor`, body: { vendor: record.vendor || 'On hold' } })}>On hold</Button><Button size="small" onClick={() => mutation.mutate({ path: `/maintenance/${record.id}/cancel`, body: {} })}>Cancel</Button><Button size="small" onClick={() => setCompleteRecord(record)}>Complete</Button></>}
          {canUpdate && ['ON_HOLD', 'WAITING_VENDOR'].includes(record.status) && <><Button size="small" onClick={() => mutation.mutate({ path: `/maintenance/${record.id}/start`, body: {} })}>Resume</Button><Button size="small" onClick={() => mutation.mutate({ path: `/maintenance/${record.id}/cancel`, body: {} })}>Cancel</Button><Button size="small" onClick={() => setCompleteRecord(record)}>Complete</Button></>}
          {canUpdate && record.status === 'COMPLETING' && <Button size="small" onClick={() => setCompleteRecord(record)}>Resume completion</Button>}
        </Stack></TableCell>
      </TableRow>)}</TableBody></Table><TablePagination component="div" count={records.length} page={maintenancePage} onPageChange={(_, nextPage) => setMaintenancePage(nextPage)} rowsPerPage={tableRowsPerPage} onRowsPerPageChange={(event) => { setTableRowsPerPage(Number(event.target.value)); setSchedulePage(0); setMaintenancePage(0); }} rowsPerPageOptions={[5, 10, 25]} /></>}
      <MaintenanceCreateDialog open={createOpen} asset={asset} saving={mutation.isPending} error={mutation.error ? message(mutation.error) : ''} onClose={() => setCreateOpen(false)} onSubmit={(values) => mutation.mutate({ path: '/maintenance', body: values })} />
      <MaintenanceCompleteDialog open={Boolean(completeRecord)} record={completeRecord} saving={mutation.isPending} error={mutation.error ? message(mutation.error) : ''} onClose={() => setCompleteRecord(null)} onSubmit={(values) => mutation.mutate({ path: `/maintenance/${completeRecord.id}/complete`, body: values })} />
      <Dialog open={Boolean(viewRecord)} onClose={() => setViewRecord(null)} fullWidth maxWidth="sm">
        <DialogTitle>Maintenance details — {viewRecord?.maintenanceNumber}</DialogTitle>
        <DialogContent dividers><Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography><strong>Status:</strong> {viewRecord?.status?.replaceAll('_', ' ')}</Typography>
          <Typography><strong>Type:</strong> {viewRecord?.type || '—'}</Typography>
          <Typography><strong>Title:</strong> {viewRecord?.title || '—'}</Typography>
          <Typography><strong>Issue or maintenance plan:</strong> {viewRecord?.issueDescription || '—'}</Typography>
          <Typography><strong>Diagnosis:</strong> {viewRecord?.diagnosis || '—'}</Typography>
          <Typography><strong>Work performed:</strong> {viewRecord?.workPerformed || '—'}</Typography>
          <Typography><strong>Parts replaced:</strong> {viewRecord?.partsReplaced?.join(', ') || '—'}</Typography>
          <Typography><strong>Vendor:</strong> {viewRecord?.vendor || '—'}</Typography>
          <Typography><strong>Notes:</strong> {viewRecord?.notes || '—'}</Typography>
          <Typography><strong>Related ticket:</strong> {viewRecord?.relatedTicket ? <Button component={Link} to={`/tickets/${viewRecord.relatedTicket._id ?? viewRecord.relatedTicket.id}`} size="small" sx={{ ml: 0.5, p: 0, minWidth: 0, verticalAlign: 'baseline' }}>{viewRecord.relatedTicket.ticketNumber ?? viewRecord.relatedTicket.title ?? 'View ticket'}</Button> : '—'}</Typography>
          <Typography><strong>Cost:</strong> {viewRecord?.cost ?? '—'} {viewRecord?.currency || ''}</Typography>
          <Typography><strong>Completed:</strong> {viewRecord?.completedAt ? new Date(viewRecord.completedAt).toLocaleString() : '—'}</Typography>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setViewRecord(null)}>Close</Button></DialogActions>
      </Dialog>
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Routine maintenance schedule</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField label="Title" value={schedule.title} onChange={(e) => setSchedule({ ...schedule, title: e.target.value })} /><TextField label="Maintenance plan" multiline minRows={3} value={schedule.description} onChange={(e) => setSchedule({ ...schedule, description: e.target.value })} /><TextField label="Start date and time" type="datetime-local" InputLabelProps={{ shrink: true }} value={schedule.startsAt} onChange={(e) => setSchedule({ ...schedule, startsAt: e.target.value })} /><Select value={schedule.frequency} onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value })}>{['DAILY', 'WEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'].map((value) => <MenuItem key={value} value={value}>{value.replaceAll('_', ' ')}</MenuItem>)}</Select><Typography variant="caption" color="text.secondary">Semi-monthly repeats every 15 days from the selected start date. Generated tickets are OPEN and unassigned.</Typography></Stack></DialogContent><DialogActions><Button onClick={() => setScheduleOpen(false)}>Cancel</Button><Button variant="contained" disabled={scheduleMutation.isPending || !schedule.title || !schedule.description || !schedule.startsAt} onClick={() => scheduleMutation.mutate()}>Save schedule</Button></DialogActions></Dialog>
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))} sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: (theme) => theme.zIndex.snackbar }}>{notice.text}</Alert>}
    </Stack>
  );
}
