import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Tooltip } from '@mui/material';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { apiClient } from '../../api/client.js';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

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
function getDefaultDueDate() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const categoryExamples = {
  Hardware: 'Laptop, desktop, monitor, keyboard, mouse, hard drive, RAM issues',
  Software: 'Office apps, OS, drivers, antivirus, in-house applications',
  Network: 'Switch, router, Wi-Fi, VLAN, cabling, local network drop',
  Internet: 'Internet outage, slow connection, proxy, firewall access',
  Printer: 'Printer offline, paper jam, toner, print quality, scanning',
  Email: 'Cannot send/receive email, mailbox full, distribution list, spam',
  'User Account': 'Account locked, password reset, new user creation, profile issue',
  Access: 'Folder permission, application access, role-based access',
  Security: 'Phishing, malware, intrusion, data leak, policy violation',
  Server: 'Server down, disk space, service crash, backup failure',
  Application: 'ERP, CRM, business app errors, login issues',
  Database: 'Database slow, connection failure, data corruption, backup',
  'Telephone/PABX': 'Phone not working, call routing, voicemail, extension setup',
  CCTV: 'Camera offline, recording issue, playback failure, access to footage',
  Backup: 'Backup failed, restore request, retention, storage full',
  'IT Asset': 'Asset assignment, return, warranty, spare part request',
  'Tool/Equipment': 'Borrow tools, equipment checkout, missing items',
  Other: 'Anything not covered by the categories above'
};

export default function TicketCreateDialog({ open, saving, error, canLinkAssets, canAssign, onClose, onSubmit }) {
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({ defaultValues: { type: 'INCIDENT', priority: 'MEDIUM', requester: '', category: '', assetReferences: [], assignedTo: '', estimatedResolutionHours: 0, estimatedResolutionMinutes: 0, resolutionDueAt: getDefaultDueDate() } });
  const selectedRequester = useWatch({ control, name: 'requester' });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const searchTerm = useDebouncedValue(employeeSearch);
  const employeesQuery = useQuery({
    queryKey: ['ticket-requester-options', searchTerm],
    enabled: open,
    queryFn: async () => (await apiClient.get('/employees', { params: { status: 'ACTIVE', ...(searchTerm ? { search: searchTerm } : {}), limit: 100 } })).data.data.items
  });
  const categoriesQuery = useQuery({
    queryKey: ['ticket-categories-active'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/ticket-categories')).data.data.items
  });
  const assetsQuery = useQuery({
    queryKey: ['ticket-requester-assets', selectedRequester],
    enabled: open && canLinkAssets && Boolean(selectedRequester),
    queryFn: async () => {
      const [assigned, borrowed] = await Promise.all([
        apiClient.get('/assets', { params: { currentCustodian: selectedRequester, limit: 100 } }),
        apiClient.get('/assets', { params: { currentBorrower: selectedRequester, limit: 100 } })
      ]);
      return [...new Map([...assigned.data.data.items, ...borrowed.data.data.items].map((asset) => [asset.id, asset])).values()];
    }
  });
  const assigneesQuery = useQuery({
    queryKey: ['ticket-assignable-users-create'],
    enabled: open && canAssign,
    queryFn: async () => (await apiClient.get('/tickets/assignable-users')).data.data.items
  });

  useEffect(() => {
    if (open) reset({ type: 'INCIDENT', priority: 'MEDIUM', requester: '', category: '', assetReferences: [], assignedTo: '', title: '', description: '', estimatedResolutionHours: 0, estimatedResolutionMinutes: 0, resolutionDueAt: getDefaultDueDate() });
    setEmployeeSearch('');
    setSelectedEmployee(null);
  }, [open, reset]);

  const categories = categoriesQuery.data ?? [];
  const employees = employeesQuery.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <form onSubmit={handleSubmit((values) => onSubmit({
        requester: values.requester,
        title: values.title,
        description: values.description,
        type: values.type,
        category: values.category,
        priority: values.priority,
        assignedTo: values.assignedTo || undefined,
        assetReferences: values.assetReferences ?? [],
        estimatedResolutionHours: values.estimatedResolutionHours,
        estimatedResolutionMinutes: values.estimatedResolutionMinutes,
        resolutionDueAt: values.resolutionDueAt || undefined
      }))}>
        <DialogTitle>Create support ticket</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">Tickets are entered by IT personnel. Employees do not log in or submit tickets themselves.</Alert>
            {error && <Alert severity="error">{error}</Alert>}
            <Controller name="requester" control={control} rules={{ required: 'Select an active employee' }} render={({ field }) => (
              <Autocomplete
                options={employees}
                loading={employeesQuery.isFetching}
                value={selectedEmployee}
                inputValue={employeeSearch}
                onInputChange={(_, value, reason) => { if (reason === 'input') setEmployeeSearch(value); }}
                onChange={(_, employee) => {
                  setSelectedEmployee(employee);
                  setEmployeeSearch(employee ? `${employee.fullName} - ${employee.department?.departmentName ?? 'No department'}` : '');
                  field.onChange(employee?.id ?? '');
                }}
                noOptionsText={employeesQuery.isError ? 'Unable to load employees' : searchTerm ? 'No matching active employees' : 'No active employees found'}
                getOptionLabel={(employee) => `${employee.fullName} - ${employee.department?.departmentName ?? 'No department'}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Requester employee" error={Boolean(errors.requester)} helperText={errors.requester?.message ?? 'Search by name or employee ID'} />}
              />
            )} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Controller name="type" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="ticket-type-label">Type</InputLabel><Select {...field} labelId="ticket-type-label" label="Type">{ticketTypes.map((type) => <MenuItem key={type} value={type}><Tooltip title={ticketTypeExamples[type]} placement="right" arrow><Box component="span" sx={{ display: 'block' }}>{type.replaceAll('_', ' ')}</Box></Tooltip></MenuItem>)}</Select></FormControl>} />
              <Controller name="priority" control={control} render={({ field }) => <FormControl fullWidth><InputLabel id="ticket-priority-label">Priority</InputLabel><Select {...field} labelId="ticket-priority-label" label="Priority">{priorities.map((priority) => <MenuItem key={priority} value={priority}>{priority}</MenuItem>)}</Select></FormControl>} />
            </Stack>
            {canAssign && <Controller name="assignedTo" control={control} render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel id="ticket-assign-label">IT assignee</InputLabel>
                <Select {...field} labelId="ticket-assign-label" label="IT assignee" disabled={assigneesQuery.isPending}>
                  <MenuItem value=""><em>Unassigned</em></MenuItem>
                  {(assigneesQuery.data ?? []).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.role}</MenuItem>)}
                </Select>
              </FormControl>
            )} />}
            <Controller name="category" control={control} rules={{ required: 'Select a category' }} render={({ field }) => (
              <Autocomplete
                options={categories}
                value={categories.find((category) => category.id === field.value) ?? null}
                onChange={(_, category) => field.onChange(category?.id ?? '')}
                getOptionLabel={(category) => category?.name ?? ''}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                noOptionsText={categoriesQuery.isError ? 'Unable to load categories' : 'No categories found'}
                renderOption={(props, category) => (
                  <li {...props} key={category.id}>
                    <Tooltip title={categoryExamples[category.name] || category.description || 'No examples configured'} placement="right" arrow>
                      <Box component="span" sx={{ display: 'block' }}>{category.name}</Box>
                    </Tooltip>
                  </li>
                )}
                renderInput={(params) => <TextField {...params} label="Category" error={Boolean(errors.category)} helperText={errors.category?.message ?? 'Search or select a category'} />}
              />
            )} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField label="Hours rendered" type="number" inputProps={{ min: 0, max: 9999 }} {...register('estimatedResolutionHours', { valueAsNumber: true })} />
              <TextField label="Minutes rendered" type="number" inputProps={{ min: 0, max: 59 }} {...register('estimatedResolutionMinutes', { valueAsNumber: true })} />
            </Stack>
            <TextField label="Resolution due" type="datetime-local" InputLabelProps={{ shrink: true }} helperText="Defaults to 24 hours from now if left blank" {...register('resolutionDueAt')} />
            {canLinkAssets && selectedRequester && <Controller name="assetReferences" control={control} render={({ field }) => {
              const assets = assetsQuery.data ?? [];
              return <Autocomplete
                multiple
                options={assets}
                loading={assetsQuery.isFetching}
                value={assets.filter((asset) => (field.value ?? []).includes(asset.id))}
                onChange={(_, selected) => field.onChange(selected.map((asset) => asset.id))}
                getOptionLabel={(asset) => `${asset.assetId} · ${asset.assetName}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} label="Requester’s assigned assets" helperText="Optional; select assets currently assigned to this employee" />}
              />;
            }} />}
            <TextField label="Title" error={Boolean(errors.title)} helperText={errors.title?.message} {...register('title', { required: 'Enter a concise title', minLength: { value: 3, message: 'Use at least 3 characters' } })} />
            <TextField label="Description" multiline minRows={4} error={Boolean(errors.description)} helperText={errors.description?.message} {...register('description', { required: 'Describe the issue or request' })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={saving || categoriesQuery.isPending}>{saving ? 'Creating…' : 'Create ticket'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
