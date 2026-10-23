import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AttachFile, CloudDownload, EditOutlined, PersonAddAlt1 } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import DirectoryNavigation from '../../components/DirectoryNavigation.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { can } from '../../utils/permissions.js';
import TicketEditDialog from './TicketEditDialog.jsx';

const transitions = {
  NEW: ['OPEN', 'CANCELLED', 'DUPLICATED'],
  OPEN: ['IN_PROGRESS', 'PENDING', 'CLOSED', 'CANCELLED', 'DUPLICATED'],
  IN_PROGRESS: ['PENDING', 'CLOSED', 'CANCELLED', 'DUPLICATED'],
  PENDING: ['IN_PROGRESS', 'CANCELLED', 'DUPLICATED'],
  CLOSED: ['OPEN', 'IN_PROGRESS'],
  CANCELLED: ['OPEN'],
  DUPLICATED: ['OPEN']
};

function errorMessage(error) {
  return error?.response?.data?.message ?? 'The operation could not be completed.';
}

function chipColor(value) {
  if (value === 'CRITICAL' || value === 'SLA_BREACHED') return 'error';
  if (value === 'HIGH' || value === 'ESCALATED' || value === 'SLA_AT_RISK') return 'warning';
  if (value === 'RESOLVED' || value === 'CLOSED' || value === 'LOW' || value === 'SLA_MET') return 'success';
  return 'default';
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function statusColor(status) {
  if (status === 'OPEN') return 'primary';
  if (status === 'IN_PROGRESS') return 'warning';
  if (status === 'PENDING') return 'secondary';
  if (status === 'CLOSED') return 'success';
  if (status === 'CANCELLED') return 'error';
  if (status === 'DUPLICATED') return 'default';
  return 'default';
}

function AttachmentPreview({ ticketId, attachment, onDownload, onPreview }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const isImage = (attachment.mimeType || '').startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let objectUrl = null;
    setLoading(true);
    apiClient.get(`/tickets/${ticketId}/attachments/${attachment._id}/download`, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [ticketId, attachment._id, attachment.mimeType, isImage]);

  return (
    <Paper variant="outlined" sx={{ p: 1, display: 'inline-flex', flexDirection: 'column', gap: 1, minWidth: 120 }}>
      {isImage ? (
        loading ? <CircularProgress size={24} /> : (
          url ? <Box component="img" src={url} alt={attachment.originalName} onDoubleClick={() => onPreview?.(url, attachment)} sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1, cursor: onPreview ? 'pointer' : 'default' }} /> : <Typography variant="caption">Preview unavailable</Typography>
        )
      ) : <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>{attachment.originalName}</Typography>}
      <Button size="small" startIcon={<CloudDownload />} onClick={() => onDownload(attachment)}>Download</Button>
    </Paper>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const troubleFileInput = useRef(null);
  const [tab, setTab] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeHours, setCloseHours] = useState(0);
  const [closeMinutes, setCloseMinutes] = useState(0);
  const [assignee, setAssignee] = useState('');
  const [askForHelpOpen, setAskForHelpOpen] = useState(false);
  const [askedForHelp, setAskedForHelp] = useState([]);
  const [troubleAttachments, setTroubleAttachments] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [notice, setNotice] = useState({ open: false, message: '', severity: 'success' });
  const { register: registerTroubleshooting, handleSubmit: handleTroubleshootingSubmit, reset: resetTroubleshooting, formState: { isSubmitting: isSubmittingTroubleshooting } } = useForm();
  const ticketQuery = useQuery({ queryKey: ['ticket', id], queryFn: async () => (await apiClient.get(`/tickets/${id}`)).data.data.ticket });
  const ticket = ticketQuery.data;
  const historyQuery = useQuery({ queryKey: ['ticket-history', id], enabled: Boolean(ticket), queryFn: async () => (await apiClient.get(`/tickets/${id}/history`)).data.data.items });
  const troubleshootingQuery = useQuery({ queryKey: ['ticket-troubleshooting', id], enabled: Boolean(ticket), queryFn: async () => (await apiClient.get(`/tickets/${id}/troubleshooting`)).data.data.items });
  const assigneesQuery = useQuery({ queryKey: ['ticket-assignable-users'], enabled: Boolean(ticket) && can(user, 'tickets.assign'), queryFn: async () => (await apiClient.get('/tickets/assignable-users')).data.data.items });
  const mentionableQuery = useQuery({ queryKey: ['ticket-mentionable-users'], enabled: Boolean(ticket) && can(user, 'tickets.update'), queryFn: async () => (await apiClient.get('/tickets/mentionable-users')).data.data.items });
  const invalidateTicket = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['ticket', id] }),
    queryClient.invalidateQueries({ queryKey: ['tickets'] }),
    queryClient.invalidateQueries({ queryKey: ['ticket-history', id] }),
    queryClient.invalidateQueries({ queryKey: ['ticket-troubleshooting', id] })
  ]);
  const updateMutation = useMutation({
    mutationFn: async (values) => (await apiClient.patch(`/tickets/${id}`, values)).data.data.ticket,
    onSuccess: async () => { await invalidateTicket(); setEditOpen(false); setEditError(''); setNotice({ open: true, message: 'Ticket updated.', severity: 'success' }); },
    onError: (error) => setEditError(errorMessage(error))
  });
  const statusMutation = useMutation({
    mutationFn: async (values) => (await apiClient.patch(`/tickets/${id}/status`, values)).data.data.ticket,
    onSuccess: async (_, values) => { await invalidateTicket(); setNotice({ open: true, message: `Ticket status updated to ${values.status.replaceAll('_', ' ')}.`, severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const assignmentMutation = useMutation({
    mutationFn: async (assignedTo) => (await apiClient.patch(`/tickets/${id}/assign`, { assignedTo: assignedTo || null })).data.data.ticket,
    onSuccess: async () => { await invalidateTicket(); setAssignmentOpen(false); setNotice({ open: true, message: 'Ticket assignment updated.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const askForHelpMutation = useMutation({
    mutationFn: async (values) => (await apiClient.patch(`/tickets/${id}/ask-for-help`, { askedForHelp: values })).data.data.ticket,
    onSuccess: async () => { await invalidateTicket(); setAskForHelpOpen(false); setNotice({ open: true, message: 'Asked for help updated.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const troubleshootingMutation = useMutation({
    mutationFn: async (values) => (await apiClient.post(`/tickets/${id}/troubleshooting`, values)).data.data.entry,
    onSuccess: async () => { await invalidateTicket(); resetTroubleshooting(); setTroubleAttachments([]); setNotice({ open: true, message: 'Troubleshooting record added.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const body = new FormData();
      body.append('file', file);
      return apiClient.post(`/tickets/${id}/attachments`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: async () => { await invalidateTicket(); setNotice({ open: true, message: 'Attachment uploaded.', severity: 'success' }); },
    onError: (error) => setNotice({ open: true, message: errorMessage(error), severity: 'error' })
  });
  const hasTroubleshooting = Boolean((troubleshootingQuery.data ?? []).length);
  const assignedToCurrentUser = Boolean(ticket?.assignedTo && user?._id && (ticket.assignedTo._id ?? ticket.assignedTo.id)?.toString() === user._id.toString());
  const canUpdateAssignedTicket = can(user, 'tickets.update') || assignedToCurrentUser;
  const allowedTransitions = useMemo(() => (transitions[ticket?.status] ?? []).filter((status) => {
    if (!ticket?.assignedTo && ['IN_PROGRESS', 'PENDING', 'CLOSED'].includes(status)) return false;
    if (status === 'CLOSED') return can(user, 'tickets.close') && hasTroubleshooting;
    if (['CLOSED', 'CANCELLED', 'DUPLICATED'].includes(ticket?.status)) return can(user, 'tickets.reopen');
    return canUpdateAssignedTicket;
  }), [ticket?.status, ticket?.assignedTo, user, hasTroubleshooting, canUpdateAssignedTicket]);

  const beginTransition = (status) => {
    if (status === 'CLOSED') {
      setCloseHours(ticket?.estimatedResolutionHours ?? 0);
      setCloseMinutes(ticket?.estimatedResolutionMinutes ?? 0);
      setCloseOpen(true);
      return;
    }
    statusMutation.mutate({ status });
  };
  const confirmClose = () => {
    const hours = Number(closeHours) || 0;
    const minutes = Number(closeMinutes) || 0;
    if (hours <= 0 && minutes <= 0) { setNotice({ open: true, message: 'Enter at least 1 hour or 1 minute rendered before closing the ticket.', severity: 'error' }); return; }
    statusMutation.mutate({ status: 'CLOSED', estimatedResolutionHours: hours, estimatedResolutionMinutes: minutes }, { onSuccess: () => setCloseOpen(false) });
  };
  const downloadAttachment = async (attachment) => {
    try {
      const response = await apiClient.get(`/tickets/${id}/attachments/${attachment._id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = attachment.originalName;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setNotice({ open: true, message: errorMessage(error), severity: 'error' });
    }
  };
  const submitTroubleshooting = handleTroubleshootingSubmit(async (values) => troubleshootingMutation.mutateAsync({
    diagnosis: values.diagnosis || undefined,
    actionTaken: values.actionTaken || undefined,
    partsReplaced: values.partsReplaced ? values.partsReplaced.split(',').map((part) => part.trim()).filter(Boolean) : [],
    attachments: troubleAttachments
  }));
  const uploadAttachmentFile = async (file) => {
    if (!file) return;
    try {
      const response = await uploadMutation.mutateAsync(file);
      const attachment = response.data.data.attachment;
      setTroubleAttachments((current) => [...current, attachment.id]);
    } catch {
      // error notice is handled by uploadMutation
    }
  };
  const uploadTroubleFile = async (event) => {
    const file = event.target.files?.[0];
    if (file) await uploadAttachmentFile(file);
    event.target.value = '';
  };

  useEffect(() => {
    const handlePaste = async (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable) return;
      const clipboard = event.clipboardData;
      if (!clipboard) return;
      const imageFile = Array.from(clipboard.files).find((file) => (file.type || '').startsWith('image/'));
      if (imageFile) {
        event.preventDefault();
        await uploadAttachmentFile(imageFile);
        return;
      }
      const imageItem = Array.from(clipboard.items).find((item) => item.kind === 'file' && (item.type || '').startsWith('image/'));
      if (imageItem) {
        event.preventDefault();
        const file = imageItem.getAsFile();
        if (file) await uploadAttachmentFile(file);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  if (ticketQuery.isPending) return <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (ticketQuery.isError) return <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}><DirectoryNavigation /><Container maxWidth="lg" sx={{ py: 4 }}><Alert severity="error">{errorMessage(ticketQuery.error)}</Alert></Container></Box>;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <DirectoryNavigation />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack spacing={3}>
          <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="overline" color="primary.main" fontWeight={700}>{ticket.ticketNumber}</Typography>
                <Typography variant="h4" component="h1" fontWeight={700}>{ticket.title}</Typography>
                <Typography color="text.secondary">{ticket.requesterSnapshot.fullName} · {ticket.requesterSnapshot.departmentName || ticket.department?.departmentName}</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={ticket.status.replaceAll('_', ' ')} color={statusColor(ticket.status)} />
                <Chip color={chipColor(ticket.priority)} label={ticket.priority} />
                <Chip variant="outlined" color={chipColor(ticket.slaStatus)} label={ticket.slaStatus.replace('SLA_', '').replaceAll('_', ' ')} />
              </Stack>
              {can(user, 'tickets.update') && !['CLOSED', 'CANCELLED', 'DUPLICATED'].includes(ticket.status) && <Button variant='contained' startIcon={<EditOutlined />} onClick={() => { setEditError(''); setEditOpen(true); }}>Edit</Button>}
            </Stack>
          </Paper>
          <Paper elevation={0} sx={{ p: 2, border: 1, borderColor: 'divider' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Stack direction="row" spacing={3} alignItems="center" sx={{ flex: 1, flexWrap: 'wrap' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">Assigned to</Typography>
                  <Typography fontWeight={600}>{ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned'}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" color="text.secondary">Asked for help</Typography>
                  <Typography fontWeight={600}>{ticket.askedForHelp?.length ? ticket.askedForHelp.map((person) => `${person.firstName} ${person.lastName}`).join(', ') : '—'}</Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={1}>
                {can(user, 'tickets.assign') && !['CLOSED', 'CANCELLED', 'DUPLICATED'].includes(ticket.status) && <Button variant='outlined' startIcon={<PersonAddAlt1 />} onClick={() => { setAssignee(ticket.assignedTo?._id ?? ''); setAssignmentOpen(true); }}>Assign / reassign</Button>}
                {can(user, 'tickets.update') && !['CLOSED', 'CANCELLED', 'DUPLICATED'].includes(ticket.status) && <Button variant='contained' startIcon={<PersonAddAlt1 />} onClick={() => { setAskedForHelp(ticket.askedForHelp?.map((person) => person._id) ?? []); setAskForHelpOpen(true); }}>Ask for help</Button>}
              </Stack>
              {allowedTransitions.length > 0 && <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="ticket-transition-label">Update status</InputLabel>
                <Select labelId="ticket-transition-label" label="Update status" value="" onChange={(event) => beginTransition(event.target.value)}>
                  {allowedTransitions.map((status) => <MenuItem key={status} value={status}>{status.replaceAll('_', ' ')}</MenuItem>)}
                </Select>
              </FormControl>}
            </Stack>
          </Paper>
          <Paper elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
              <Tab label="Overview" />
              <Tab label={`Troubleshooting (${troubleshootingQuery.data?.length ?? 0})`} />
              <Tab label="History" />
            </Tabs>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {tab === 0 && <Stack spacing={3}>
                <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}>
                  <Paper variant="outlined" sx={{ p: 2.5, flex: 2 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>Request</Typography>
                    <Stack spacing={1.5}>
                      <Typography><strong>Type:</strong> {ticket.type.replaceAll('_', ' ')}</Typography>
                      <Typography><strong>Category:</strong> {ticket.categoryNameSnapshot}{ticket.subcategory ? ` · ${ticket.subcategory}` : ''}</Typography>
                      <Typography><strong>Location:</strong> {ticket.location || '—'}</Typography>
                      <Divider />
                      <Typography whiteSpace="pre-wrap"><strong>Description:</strong> {ticket.description}</Typography>
                    </Stack>
                  </Paper>
                  <Paper variant="outlined" sx={{ p: 2.5, flex: 1 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom>Requester</Typography>
                    <Stack spacing={1.5}>
                      <Typography><strong>Employee:</strong> {ticket.requesterSnapshot.fullName || '—'}</Typography>
                      <Typography><strong>Department:</strong> {ticket.requesterSnapshot.departmentName || '—'}</Typography>
                      <Typography><strong>Position:</strong> {ticket.requesterSnapshot.position || '—'}</Typography>
                      <Typography><strong>Contact:</strong> {ticket.requesterSnapshot.contactNumber || '—'}</Typography>
                      <Typography><strong>Email:</strong> {ticket.requesterSnapshot.email || '—'}</Typography>
                    </Stack>
                  </Paper>
                </Stack>
                <Paper variant="outlined" sx={{ p: 2.5 }}>
                  <Typography variant="h6" fontWeight={700} gutterBottom>Related assets</Typography>
                  {ticket.assetReferences?.length ? <Stack direction="row" spacing={1} flexWrap="wrap">{ticket.assetReferences.map((asset) => <Button key={asset._id} component={Link} to={`/assets/${asset._id}`}>{asset.assetId} · {asset.assetName}</Button>)}</Stack> : <Typography color="text.secondary">No related assets linked.</Typography>}
                </Paper>
              </Stack>}
              {tab === 1 && <Stack spacing={3}>
                {troubleshootingQuery.isError && <Alert severity="error">{errorMessage(troubleshootingQuery.error)}</Alert>}
                {troubleshootingQuery.isPending ? <CircularProgress size={24} /> : (troubleshootingQuery.data ?? []).map((entry) => <Paper variant="outlined" key={entry._id} sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between"><Typography fontWeight={700}>Troubleshooting record</Typography><Typography variant="caption" color="text.secondary">{formatDate(entry.recordedAt)}</Typography></Stack>
                  <Typography variant="body2" color="text.secondary">{entry.technician?.firstName} {entry.technician?.lastName}</Typography>
                  {entry.diagnosis && <Typography sx={{ mt: 1 }}><strong>Diagnosis:</strong> {entry.diagnosis}</Typography>}
                  {entry.actionTaken && <Typography sx={{ mt: 1 }}><strong>Action:</strong> {entry.actionTaken}</Typography>}
                  {entry.partsReplaced?.length > 0 && <Typography sx={{ mt: 1 }}><strong>Parts replaced:</strong> {entry.partsReplaced.join(', ')}</Typography>}
                  {(entry.attachments ?? []).length > 0 && <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 2 }}>{entry.attachments.map((attachment) => <AttachmentPreview key={attachment._id} ticketId={id} attachment={attachment} onDownload={downloadAttachment} onPreview={(url, attachment) => setPreviewImage({ url, attachment })} />)}</Stack>}
                </Paper>)}
                {can(user, 'tickets.update') && !['CLOSED', 'CANCELLED', 'DUPLICATED'].includes(ticket.status) && <Stack component="form" spacing={1.5} onSubmit={submitTroubleshooting}>
                  <Typography variant="h6" fontWeight={700}>Record troubleshooting</Typography>
                  <TextField label="Diagnosis" multiline minRows={2} {...registerTroubleshooting('diagnosis')} />
                  <TextField label="Action taken" multiline minRows={2} {...registerTroubleshooting('actionTaken')} />
                  <TextField label="Parts replaced" helperText="Separate parts with commas" {...registerTroubleshooting('partsReplaced')} />
                  <Box>
                    <input ref={troubleFileInput} type="file" hidden accept=".jpg,.jpeg,.png,.pdf,.docx,.xlsx,.txt" onChange={uploadTroubleFile} />
                    <Button variant="outlined" startIcon={<AttachFile />} onClick={() => troubleFileInput.current?.click()} disabled={uploadMutation.isPending}>{uploadMutation.isPending ? 'Uploading…' : 'Attach file'}</Button>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>JPG, PNG, PDF, DOCX, XLSX, or TXT · max 10 MB</Typography>
                  </Box>
                  {troubleAttachments.length > 0 && <Typography variant="body2" color="text.secondary">Attached: {troubleAttachments.length} file(s)</Typography>}
                  <Button type="submit" variant="contained" disabled={troubleshootingMutation.isPending || isSubmittingTroubleshooting} sx={{ alignSelf: 'flex-start' }}>Save troubleshooting record</Button>
                </Stack>}
              </Stack>}
              {tab === 2 && <Stack spacing={1.5}>{historyQuery.isError && <Alert severity="error">{errorMessage(historyQuery.error)}</Alert>}{historyQuery.isPending ? <CircularProgress size={24} /> : (historyQuery.data ?? []).map((entry) => <Paper variant="outlined" key={entry._id} sx={{ p: 2 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Typography fontWeight={700}>{entry.description}</Typography><Typography variant="caption" color="text.secondary">{formatDate(entry.createdAt)}</Typography></Stack><Typography variant="body2" color="text.secondary">{entry.actor?.firstName} {entry.actor?.lastName} · {entry.action}{entry.fromStatus ? ` · ${entry.fromStatus} → ${entry.toStatus}` : ''}</Typography></Paper>)}</Stack>}
            </Box>
          </Paper>
        </Stack>
      </Container>
      <TicketEditDialog open={editOpen} ticket={ticket} saving={updateMutation.isPending} error={editError} canAssign={can(user, 'tickets.assign')} onClose={() => setEditOpen(false)} onSubmit={(values) => updateMutation.mutate(values)} />
      <Dialog open={closeOpen} onClose={() => setCloseOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Close ticket</DialogTitle>
        <DialogContent><Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Enter the total IT effort rendered before closing this ticket.</Typography><Stack direction="row" spacing={2}><TextField fullWidth label="Hours rendered" type="number" inputProps={{ min: 0, max: 9999 }} value={closeHours} onChange={(event) => setCloseHours(event.target.value)} /><TextField fullWidth label="Minutes rendered" type="number" inputProps={{ min: 0, max: 59 }} value={closeMinutes} onChange={(event) => setCloseMinutes(event.target.value)} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setCloseOpen(false)}>Cancel</Button><Button variant="contained" disabled={statusMutation.isPending} onClick={confirmClose}>Close ticket</Button></DialogActions>
      </Dialog>
      <Dialog open={assignmentOpen} onClose={() => setAssignmentOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Assign ticket</DialogTitle>
        <DialogContent><FormControl fullWidth sx={{ mt: 1 }}><InputLabel id="ticket-assignee-label">IT assignee</InputLabel><Select labelId="ticket-assignee-label" label="IT assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}><MenuItem value="">Unassigned</MenuItem>{(assigneesQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.role}</MenuItem>)}</Select></FormControl></DialogContent>
        <DialogActions><Button onClick={() => setAssignmentOpen(false)}>Cancel</Button><Button variant="contained" disabled={assignmentMutation.isPending || assigneesQuery.isPending} onClick={() => assignmentMutation.mutate(assignee)}>Save assignment</Button></DialogActions>
      </Dialog>
      <Dialog open={askForHelpOpen} onClose={() => setAskForHelpOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Ask for help</DialogTitle>
        <DialogContent>
          {(mentionableQuery.data ?? []).filter((item) => item.id !== ticket.assignedTo?._id).length > 0 && <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel id="ticket-ask-help-label">Tag IT staff</InputLabel>
            <Select labelId="ticket-ask-help-label" label="Tag IT staff" multiple value={askedForHelp.filter((value) => value !== ticket.assignedTo?._id)} onChange={(event) => setAskedForHelp(event.target.value)} renderValue={(selected) => <Stack direction="row" spacing={0.5} flexWrap="wrap">{selected.map((value) => { const person = mentionableQuery.data.find((item) => item.id === value); return <Chip key={value} size="small" label={person ? person.name : value} />; })}</Stack>}>
              {mentionableQuery.data.filter((item) => item.id !== ticket.assignedTo?._id).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.role}</MenuItem>)}
            </Select>
          </FormControl>}
        </DialogContent>
        <DialogActions><Button onClick={() => setAskForHelpOpen(false)}>Cancel</Button><Button variant="contained" disabled={askForHelpMutation.isPending || mentionableQuery.isPending} onClick={() => askForHelpMutation.mutate(askedForHelp.filter((value) => value !== ticket.assignedTo?._id))}>Save</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(previewImage)} onClose={() => setPreviewImage(null)} fullWidth maxWidth="lg">
        <DialogTitle>{previewImage?.attachment?.originalName}</DialogTitle>
        <DialogContent>{previewImage && <Box component="img" src={previewImage.url} alt={previewImage.attachment.originalName} sx={{ width: '100%', borderRadius: 1 }} />}</DialogContent>
        <DialogActions>
          <Button startIcon={<CloudDownload />} onClick={() => { if (previewImage) downloadAttachment(previewImage.attachment); }}>Download</Button>
          <Button onClick={() => setPreviewImage(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      {notice.open && <Alert severity={notice.severity} onClose={() => setNotice((current) => ({ ...current, open: false }))} sx={{ position: 'fixed', top: { xs: 72, sm: 88 }, left: '50%', transform: 'translateX(-50%)', zIndex: (theme) => theme.zIndex.snackbar, minWidth: { xs: 'calc(100% - 32px)', sm: 420 } }}>{notice.message}</Alert>}
    </Box>
  );
}
