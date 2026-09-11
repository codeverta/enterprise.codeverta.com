import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SearchableItemSelect } from './SalesInvoicePage'

describe('Sales Invoice item selector', () => {
  it('portals its dropdown outside the horizontally scrollable table', async () => {
    render(
      <div data-testid="invoice-table-scroll" className="overflow-x-auto">
        <table>
          <tbody>
            <tr>
              <td>
                <SearchableItemSelect
                  value=""
                  itemOptions={[
                    { item_code: 'ITEM-001', item_name: 'Produk Satu', uom: 'Pcs', rate: 25_000 },
                  ]}
                  onChange={vi.fn()}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: /pilih item/i }))

    const menu = await screen.findByRole('listbox', {
      name: 'Ketik kode, nama, atau barcode item...',
    })
    const scrollContainer = screen.getByTestId('invoice-table-scroll')
    const portalWrapper = menu.closest('[data-radix-popper-content-wrapper]')

    expect(scrollContainer).not.toContainElement(menu)
    expect(portalWrapper?.parentElement).toBe(document.body)
    expect(menu).toHaveClass('max-w-[calc(100vw-24px)]')
    expect(screen.getByRole('button', { name: /ITEM-001/i })).toBeVisible()
  })

  it('returns the original item option and closes the dropdown', async () => {
    const item = { item_code: 'ITEM-002', item_name: 'Produk Dua', uom: 'Box', rate: 50_000 }
    const onChange = vi.fn()
    render(<SearchableItemSelect value="" itemOptions={[item]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /pilih item/i }))
    fireEvent.click(await screen.findByRole('button', { name: /ITEM-002/i }))

    expect(onChange).toHaveBeenCalledWith(item)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
