import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Popper, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { apiClient } from '../../api/client.js';

function TicketEditAssetOption({ asset, optionProps }) {
  const { key, ...props } = optionProps;
  const [hovered, setHovered] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const imageQuery = useQuery({
    queryKey: ['ticket-edit-asset-images', asset.id],
    enabled: hovered,
    queryFn: async () => (await apiClient.get(`/assets/${asset.id}/images`)).data.data.images
  });
  const image = imageQuery.data?.find((item) => item.isPrimary) ?? imageQuery.data?.[0];

  return (
    <Box component="li" key={key} {...props} onMouseEnter={(event) => { setHovered(true); setAnchorEl(event.currentTarget); }} onMouseLeave={() => { setHovered(false); setAnchorEl(null); }}>
      <Typography variant="body2">{asset.assetId} · {asset.assetName}</Typography>
      {image && <Popper open={hovered} placement="right-start" anchorEl={anchorEl} sx={{ zIndex: 1500, pointerEvents: 'none' }}>
        <Box sx={{ p: 0.75, bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1.5, boxShadow: 6 }}>
          <Box component="img" src={`/api/assets/${asset.id}/images/${image._id ?? image.id}`} alt={`${asset.assetId} preview`} sx={{ display: 'block', width: 420, height: 420, objectFit: 'contain', bgcolor: 'grey.100', borderRadius: 1 }} />
        </Box>
      </Popper>}
    </Box>
  );
}

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

export default function TicketEditDialog({ open, ticket, saving, error, canAssign, canLinkAssets, onClose, onSubmit }) {
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const selectedRequester = useWatch({ control, name: 'requester' });
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
  const employeesQuery = useQuery({
    queryKey: ['ticket-edit-employees'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/employees', { params: { status: 'ACTIVE', limit: 100 } })).data.data.items
  });
  const assetsQuery = useQuery({
    queryKey: ['ticket-edit-requester-assets', selectedRequester],
    enabled: open && canLinkAssets && Boolean(selectedRequester),
    queryFn: async () => {
      const [assigned, borrowed] = await Promise.all([
        apiClient.get('/assets', { params: { currentCustodian: selectedRequester, limit: 100 } }),
        apiClient.get('/assets', { params: { currentBorrower: selectedRequester, limit: 100 } })
      ]);
      return [...new Map([...assigned.data.data.items, ...borrowed.data.data.items].map((asset) => [asset.id, asset])).values()];
    }
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
      requester: ticket?.requester?._id ?? ticket?.requester ?? '',
      assetReferences: (ticket?.assetReferences ?? []).map((asset) => asset._id ?? asset),
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
        resolutionDueAt: values.resolutionDueAt || undefined,
        requester: values.requester,
        assetReferences: values.assetReferences ?? []
      }))}>
        <DialogTitle>Update ticket details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <Controller name="requester" control={control} rules={{ required: 'Requester is required' }} render={({ field }) => <Autocomplete
              options={employeesQuery.data ?? []}
              value={(employeesQuery.data ?? []).find((employee) => employee.id === field.value) ?? (ticket?.requester?.id ? ticket.requester : null)}
              onChange={(_, employee) => field.onChange(employee?.id ?? '')}
              getOptionLabel={(employee) => `${employee.fullName} - ${employee.employeeId ?? ''}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Requester employee" error={Boolean(errors.requester)} helperText={errors.requester?.message} />}
            />} />
            {canLinkAssets && selectedRequester && <Controller name="assetReferences" control={control} render={({ field }) => <Autocomplete
              multiple
              options={assetsQuery.data ?? []}
              value={(assetsQuery.data ?? []).filter((asset) => (field.value ?? []).includes(asset.id))}
              onChange={(_, selected) => field.onChange(selected.map((asset) => asset.id))}
              getOptionLabel={(asset) => `${asset.assetId} · ${asset.assetName}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderOption={(props, asset) => <TicketEditAssetOption key={asset.id} optionProps={props} asset={asset} />}
              renderInput={(params) => <TextField {...params} label="Requester’s assigned assets" helperText="Optional; select assets currently assigned to this employee" />}
            />} />}
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
