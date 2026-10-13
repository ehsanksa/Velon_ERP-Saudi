import { apiFetch } from '@/lib/api/client';
import { API_V1_BASE } from '@/lib/api/config';
import { getAccessToken } from '@/lib/auth/session';

export type CompanyLibraryAssetCategory =
  | 'COMPANY_PROFILE'
  | 'PRODUCT_CATALOG'
  | 'BROCHURE'
  | 'CERTIFICATION'
  | 'LICENSE'
  | 'CASE_STUDY'
  | 'AWARD'
  | 'PRESENTATION'
  | 'MARKETING'
  | 'OTHER';

export type CompanyLibraryAsset = {
  id: string;
  tenantId: string;
  name: string;
  category: CompanyLibraryAssetCategory;
  description: string | null;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  contentJson: Record<string, unknown> | null;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: { id: string; name: string; email: string } | null;
};

export type CrmContentBlock = {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  description: string | null;
  contentJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function q(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function loadCompanyAssets(filters?: {
  category?: CompanyLibraryAssetCategory;
  search?: string;
}) {
  return apiFetch<CompanyLibraryAsset[]>(
    `/crm/company-assets${q({
      category: filters?.category,
      search: filters?.search,
    })}`,
  );
}

export function createCompanyAsset(data: {
  name: string;
  category: CompanyLibraryAssetCategory;
  description?: string;
  mimeType: string;
  fileName: string;
  fileBase64: string;
  contentJson?: Record<string, unknown>;
}) {
  return apiFetch<CompanyLibraryAsset>('/crm/company-assets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteCompanyAsset(id: string) {
  return apiFetch(`/crm/company-assets/${id}`, { method: 'DELETE' });
}

export function companyAssetDownloadUrl(id: string) {
  return `${API_V1_BASE}/crm/company-assets/${id}/download`;
}

export async function loadCompanyAssetBlob(id: string) {
  const token = getAccessToken();
  const res = await fetch(companyAssetDownloadUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to download asset');
  return res.blob();
}

export async function downloadCompanyAsset(id: string, fileName?: string) {
  const blob = await loadCompanyAssetBlob(id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName ?? 'asset';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function loadContentBlocks(filters?: { category?: string; search?: string }) {
  return apiFetch<CrmContentBlock[]>(
    `/crm/content-blocks${q({
      category: filters?.category,
      search: filters?.search,
    })}`,
  );
}

export function createContentBlock(data: {
  name: string;
  category?: string;
  description?: string;
  contentJson: Record<string, unknown>;
}) {
  return apiFetch<CrmContentBlock>('/crm/content-blocks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteContentBlock(id: string) {
  return apiFetch(`/crm/content-blocks/${id}`, { method: 'DELETE' });
}

export async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}
