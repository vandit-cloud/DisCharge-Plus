// Server data hooks (TanStack Query). Keys follow docs/11-build-layout.md §5.3.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './api.js';

export const usePlan = (patientId) =>
  useQuery({ queryKey: ['plan', patientId], queryFn: () => api(`/patients/${patientId}/plan`), enabled: Boolean(patientId) });

export const useDoses = (patientId, range = {}) =>
  useQuery({
    queryKey: ['doses', patientId, range.from ?? 'today', range.to ?? 'today'],
    queryFn: () => api(`/patients/${patientId}/doses`, { query: range }).then((r) => r.doses),
    enabled: Boolean(patientId),
    refetchInterval: 60_000, // the "can mark" window moves with the clock
  });

export const useAdherence = (patientId) =>
  useQuery({
    queryKey: ['adherence', patientId],
    queryFn: () => api(`/patients/${patientId}/adherence`).then((r) => r.adherence),
    enabled: Boolean(patientId),
  });

export const useFollowUps = (patientId) =>
  useQuery({
    queryKey: ['followups', patientId],
    queryFn: () => api(`/patients/${patientId}/followups`).then((r) => r.followUps),
    enabled: Boolean(patientId),
  });

export const useSymptoms = (patientId) =>
  useQuery({
    queryKey: ['symptoms', patientId],
    queryFn: () => api(`/patients/${patientId}/symptoms`).then((r) => r.symptomLogs),
    enabled: Boolean(patientId),
  });

export const usePatient = (patientId) =>
  useQuery({
    queryKey: ['patient', patientId],
    queryFn: () => api(`/patients/${patientId}`).then((r) => r.patient),
    enabled: Boolean(patientId),
  });

export const usePatients = (filters) =>
  useQuery({
    queryKey: ['patients', filters],
    queryFn: () => api('/patients', { query: filters }).then((r) => r.patients),
    placeholderData: keepPreviousData, // no spinner flash on every keystroke
  });

export const useEscalations = (filters = {}) =>
  useQuery({
    queryKey: ['escalations', filters],
    queryFn: () => api('/escalations', { query: filters }).then((r) => r.escalations),
    refetchInterval: 30_000, // FR-5.4: a new emergency appears without reloading
  });

export const useEscalation = (id) =>
  useQuery({ queryKey: ['escalation', id], queryFn: () => api(`/escalations/${id}`).then((r) => r.escalation) });

export const useDashboard = () =>
  useQuery({ queryKey: ['dashboard'], queryFn: () => api('/dashboard'), refetchInterval: 60_000 });

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api('/meta'), staleTime: Infinity });
