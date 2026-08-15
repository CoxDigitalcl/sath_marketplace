import type { PolicyDocument } from '../types';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : null
);

export const readLegalPolicies = (payload: unknown): PolicyDocument[] => {
  const root = asRecord(payload);
  if (!root) return [];

  const data = asRecord(root.data);
  const candidates = [
    data?.legal_policies,
    data?.value,
    root.legal_policies,
    root.value,
  ];

  const policies = candidates.find(Array.isArray);
  return Array.isArray(policies) ? policies as PolicyDocument[] : [];
};

export const buildLegalPoliciesSettingsRequest = (policies: PolicyDocument[]) => ({
  group: 'legal_policies',
  settings: {
    legal_policies: policies,
  },
});
