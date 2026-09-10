import { Ban, CopyPlus, Loader2, Save, Send } from 'lucide-react'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BaseDocument, docStatusLabel } from '@/lib/doctype'

interface DocumentActionBarProps {
  document: Partial<BaseDocument>
  dirty?: boolean
  action?: 'save' | 'submit' | 'cancel' | 'amend' | null
  disabled?: boolean
  onSave: () => void | Promise<unknown>
  onSubmit: () => void | Promise<unknown>
  onCancel: () => void | Promise<unknown>
  onAmend: () => void | Promise<unknown>
}

export function DocumentActionBar({
  document,
  dirty,
  action,
  disabled,
  onSave,
  onSubmit,
  onCancel,
  onAmend,
}: DocumentActionBarProps) {
  const status = document.doc_status ?? 0
  const busy = Boolean(action)
  const icon = (name: typeof action, fallback: ReactNode) =>
    action === name ? <Loader2 className="animate-spin" /> : fallback

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant={status === 1 ? 'default' : status === 2 ? 'destructive' : 'secondary'}>
          {docStatusLabel(status)}
        </Badge>
        {document.document_no && <span className="text-sm font-medium">{document.document_no}</span>}
        {document.version && <span className="text-xs text-muted-foreground">Rev. {document.version}</span>}
      </div>

      <div className="flex items-center gap-2">
        {status === 0 && (
          <>
            <Button variant="outline" disabled={disabled || busy || (!dirty && Boolean(document.id))} onClick={onSave}>
              {icon('save', <Save />)} Simpan
            </Button>
            {document.id && (
              <Button disabled={disabled || busy || dirty} onClick={onSubmit}>
                {icon('submit', <Send />)} Submit
              </Button>
            )}
          </>
        )}
        {status === 1 && (
          <Button variant="destructive" disabled={disabled || busy} onClick={onCancel}>
            {icon('cancel', <Ban />)} Cancel
          </Button>
        )}
        {status === 2 && (
          <Button disabled={disabled || busy} onClick={onAmend}>
            {icon('amend', <CopyPlus />)} Amend
          </Button>
        )}
      </div>
    </div>
  )
}
