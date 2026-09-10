import api from '@/lib/api'

export type DocStatus = 0 | 1 | 2

export interface BaseDocument {
  id: string
  tenant_id: string
  document_no: string
  base_document_no: string
  doc_status: DocStatus
  version: number
  amendment_no: number
  amended_from?: string
  submitted_at?: string | null
  cancelled_at?: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRevision<T extends BaseDocument = BaseDocument> {
  id: string
  tenant_id: string
  doctype: string
  document_id: string
  version: number
  action: 'create' | 'save' | 'submit' | 'cancel' | 'amend'
  data: string
  actor_id?: string
  created_at: string
  snapshot?: T
}

export interface DocTypeList<T> {
  data: T[]
  meta: { page: number; limit: number; total: number }
}

const pathFor = (doctype: string) => `/doctype/${encodeURIComponent(doctype)}`

export function createDocTypeClient<T extends BaseDocument>(doctype: string) {
  const basePath = pathFor(doctype)
  const documentPath = (id: string) => `${basePath}/${encodeURIComponent(id)}`

  return {
    async list(params?: { page?: number; limit?: number; q?: string; doc_status?: DocStatus }) {
      const { data } = await api.get<DocTypeList<T>>(basePath, { params })
      return data
    },
    async get(id: string) {
      const { data } = await api.get<T>(documentPath(id))
      return data
    },
    async create(document: Partial<T>) {
      const { data } = await api.post<T>(basePath, document)
      return data
    },
    async save(document: T) {
      const { data } = await api.put<T>(documentPath(document.id), document)
      return data
    },
    async submit(id: string) {
      const { data } = await api.post<T>(`${documentPath(id)}/submit`)
      return data
    },
    async cancel(id: string) {
      const { data } = await api.post<T>(`${documentPath(id)}/cancel`)
      return data
    },
    async amend(id: string) {
      const { data } = await api.post<T>(`${documentPath(id)}/amend`)
      return data
    },
    async revisions(id: string) {
      const { data } = await api.get<{ data: DocumentRevision<T>[] }>(`${documentPath(id)}/revisions`)
      return data.data.map((revision) => {
        try {
          return { ...revision, snapshot: JSON.parse(revision.data) as T }
        } catch {
          return revision
        }
      })
    },
  }
}

export function docStatusLabel(status: DocStatus) {
  return status === 1 ? 'Submitted' : status === 2 ? 'Cancelled' : 'Draft'
}
