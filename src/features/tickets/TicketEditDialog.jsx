import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Tooltip } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { apiClient } from '../../api/client.js';

const ticketTypes = ['INCIDENT', 'SERVICE_REQUEST', 'ASSET_REQUEST', 'ACCESS_REQUEST', 'SECURITY_INCIDENT', 'CHANGE_REQUEST', 'MAINTENANCE', 'OTHER'];
const ticketTypeExamples = {
  INCIDENT: 'Laptop will not boot • Blue screen or system crash • Email not sending/receiving • Printer offline or jammed • Application keeps crashing • Network drop in a department • Wi-Fi not connecting • Monitor has no display',
  SERVICE_REQUEST: 'Install or update software • Create new mailbox or distribution list • Set up VPN access • Activate software license • Configure shared mailbox • Add printer on a workstation • Request new email alias',
  ASSET_REQUEST: 'Request new laptop for onboarding • Request monitor, keyboard, or mouse • Need laptop charger or power adapter • Borrow projector for meeting • Request headset or webcam • Request spare RAM or SSD',
  ACCESS_REQUEST: 'Grant access to shared folder • Unlock locked user account • Request temporary admin rights • Add user to application/system • Reset password for system • Request access to restricted site',
  SECURITY_INCIDENT: 'Report suspected phishing email • Lost or stolen laptop • Unauthorized access attempt • Malware or virus detected • Ransomware warning • Data leak or suspicious file sharing • Compromised user account',
  CHANGE_REQUEST: 'Upgrade server operating system • Change firewall or network rule • Migrate department to new application • Update email retention policy • Replace core switch • Deploy new Active Directory policy',
  MAINTENANCE: 'Apply Windows or server updates • Run server health check • Replace aging hard drive proactively • Clean up backup files • Restart/patch network equipment • Verify UPS battery status • Update antivirus definitions',
  OTHER: 'General IT inquiry • Follow-up on previous ticket • Escalation from another department • Request not covered by standard types • Advice on IT procurement • Vendor coordination'
};
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TicketEditDialog({ open, ticket, saving, error, canAssign, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories-active'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/ticket-categories')).data.data.items
  });
  const assigneesQuery = useQuery({
    queryKey: ['ticket-assignable-users-edit'],
    enabled: open && canAssign,
    queryFn: async () => (await apiClient.get('/tickets/assignable-users')).data.data.items
  });

  const currentCategory = ticket?.category ? {
    ...ticket.category,
    id: ticket.category.id ?? ticket.category._id
  } : null;
  const categories = [...(categoriesQuery.data ?? [])];
  if (currentCategory && !categories.some((category) => category.id === currentCategory.id)) categories.unshift(currentCategory);

  useEffect(() => {
    const isDuplicated = ticket?.status === 'DUPLICATED';
    reset({
      title: ticket?.title ?? '',
      description: ticket?.description ?? '',
      type: ticket?.type ?? 'INCIDENT',
      priority: ticket?.priority ?? 'MEDIUM',
      category: ticket?.category?._id ?? ticket?.category ?? '',
      assignedTo: ticket?.assignedTo?._id ?? '',
      estimatedResolutionHours: isDuplicated ? 0 : (ticket?.estimatedResolutionHours ?? 0),
      estimatedResolutionMinutes: isDuplicated ? 0 : (ticket?.estimatedResolutionMinutes ?? 0),
      resolutionDueAt: isDuplicated ? '' : toDateTimeLocal(ticket?.resolutionDueAt)
    });
  }, [open, reset, ticket]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        title: values.title,
        description: values.description,
        type: values.type,
        priority: values.priority,
        category: values.category,
        assignedTo: values.assignedTo || undefined,
        estimatedResolutionHours: Number.isFinite(values.estimatedResolutionHours) ? values.estimatedResolutionHours : undefined,
        estimatedResolutionMinutes: Number.isFinite(values.estimatedResolutionMinutes) ? values.estimatedResolutionMinutes : undefined,
        resolutionDueAt: values.resolutionDueAt || undefined
      }))}>
        <DialogTitle>Update ticket details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller name="type" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="ticket-edit-type-label">Type</InputLabel><Select {...field} labelId="ticket-edit-type-label" label="Type">{ticketTypes.map((value) => <MenuItem key={value} value={value}><Tooltip title={ticketTypeExamples[value]} placement="right" arrow><Box component="span" sx={{ display: 'block' }}>{value.replaceAll('_', ' ')}</Box></Tooltip></MenuItem>)}</Select></FormControl>} />
              <Controller name="priority" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="ticket-edit-priority-label">Priority</InputLabel><Select {...field} labelId="ticket-edit-priority-label" label="Priority">{priorities.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</Select></FormControl>} />
            </Stack>
            {canAssign && <Controller name="assignedTo" control={control} render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="ticket-edit-assign-label">IT assignee</InputLabel>
                <Select {...field} labelId="ticket-edit-assign-label" label="IT assignee" disabled={assigneesQuery.isPending}>
                  <MenuItem value=""><em>Unassigned</em></MenuItem>
                  {(assigneesQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.role}</MenuItem>)}
                </Select>
              </FormControl>
            )} />}
            <Controller name="category" control={control} rules={{ required: 'Category is required' }} render={({ field }) => (
              <Autocomplete
                options={categories}
                value={categories.find((category) => category.id === field.value) ?? null}
                onChange={(_, category) => field.onChange(category?.id ?? '')}
                getOptionLabel={(category) => category.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Category" error={Boolean(errors.category)} helperText={errors.category?.message} />}
              />
            )} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Hours rendered" type="number" inputProps={{ min: 0, max: 9999 }} disabled={ticket?.status === 'DUPLICATED'} {...register('estimatedResolutionHours', { valueAsNumber: true })} />
              <TextField label="Minutes rendered" type="number" inputProps={{ min: 0, max: 59 }} disabled={ticket?.status === 'DUPLICATED'} {...register('estimatedResolutionMinutes', { valueAsNumber: true })} />
            </Stack>
            <TextField label="Resolution due" type="datetime-local" InputLabelProps={{ shrink: true }} helperText="Leave blank to keep the current due date" disabled={ticket?.status === 'DUPLICATED'} {...register('resolutionDueAt')} />
            <TextField label="Title" error={Boolean(errors.title)} helperText={errors.title?.message} {...register('title', { required: 'Title is required', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Description" multiline minRows={4} error={Boolean(errors.description)} helperText={errors.description?.message} {...register('description', { required: 'Description is required' })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={onClose}>Cancel</Button><Button type="submit" variant="contained" disabled={saving || categoriesQuery.isPending}>{saving ? 'Saving…' : 'Save changes'}</Button></DialogActions>
      </form>
    </Dialog>
  );
}
