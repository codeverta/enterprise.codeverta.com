import { useCallback, useEffect, useMemo, useState } from 'react'

import { BaseDocument, createDocTypeClient, DocumentRevision } from '@/lib/doctype'

type LifecycleAction = 'save' | 'submit' | 'cancel' | 'amend'

interface UseDocTypeDocumentOptions<T extends BaseDocument> {
  doctype: string
  id?: string
  initialDocument: () => Partial<T>
  onAmended?: (document: T) => void
}

export function useDocTypeDocument<T extends BaseDocument>({
  doctype,
  id,
  initialDocument,
  onAmended,
}: UseDocTypeDocumentOptions<T>) {
  const client = useMemo(() => createDocTypeClient<T>(doctype), [doctype])
  const [document, setDocument] = useState<Partial<T>>(initialDocument)
  const [revisions, setRevisions] = useState<DocumentRevision<T>[]>([])
  const [loading, setLoading] = useState(Boolean(id))
  const [action, setAction] = useState<LifecycleAction | null>(null)
  const [dirty, setDirty] = useState(!id)
  const [error, setError] = useState<unknown>(null)

  const reload = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const next = await client.get(id)
      setDocument(next)
      setDirty(false)
      return next
    } catch (cause) {
      setError(cause)
      throw cause
    } finally {
      setLoading(false)
    }
  }, [client, id])

  useEffect(() => {
    void reload()
  }, [reload])

  const updateDocument = useCallback((change: Partial<T> | ((current: Partial<T>) => Partial<T>)) => {
    setDocument((current) => typeof change === 'function' ? change(current) : { ...current, ...change })
    setDirty(true)
  }, [])

  const run = useCallback(async (nextAction: LifecycleAction) => {
    setAction(nextAction)
    setError(null)
    try {
      let next: T
      if (nextAction === 'save') {
        next = document.id
          ? await client.save(document as T)
          : await client.create(document)
      } else if (nextAction === 'submit') {
        next = await client.submit(document.id as string)
      } else if (nextAction === 'cancel') {
        next = await client.cancel(document.id as string)
      } else {
        next = await client.amend(document.id as string)
        onAmended?.(next)
      }
      setDocument(next)
      setDirty(false)
      return next
    } catch (cause) {
      setError(cause)
      throw cause
    } finally {
      setAction(null)
    }
  }, [client, document, onAmended])

  const loadRevisions = useCallback(async () => {
    if (!document.id) return []
    const rows = await client.revisions(document.id)
    setRevisions(rows)
    return rows
  }, [client, document.id])

  return {
    document,
    setDocument: updateDocument,
    loading,
    action,
    dirty,
    error,
    revisions,
    reload,
    loadRevisions,
    save: () => run('save'),
    submit: () => run('submit'),
    cancel: () => run('cancel'),
    amend: () => run('amend'),
  }
}
