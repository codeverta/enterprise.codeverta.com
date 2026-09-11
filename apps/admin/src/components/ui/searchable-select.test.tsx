import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SearchableSelect } from './searchable-select'

describe('SearchableSelect', () => {
  it('renders its menu in a portal so table overflow cannot clip it', async () => {
    render(
      <div data-testid="table-scroll" className="overflow-x-auto">
        <SearchableSelect
          value=""
          options={[{ value: 'ITEM-001', label: 'ITEM-001', sublabel: 'Produk Satu' }]}
          onChange={vi.fn()}
          placeholder="Pilih Item Code..."
          searchPlaceholder="Cari item..."
        />
      </div>,
    )

    fireEvent.click(screen.getByRole('button', { name: /pilih item code/i }))

    const menu = await screen.findByRole('listbox', { name: 'Cari item...' })
    expect(screen.getByTestId('table-scroll')).not.toContainElement(menu)
    expect(menu.closest('[data-radix-popper-content-wrapper]')?.parentElement).toBe(document.body)
    expect(menu).toHaveClass('w-[var(--radix-popover-trigger-width)]')
    expect(within(menu).getByRole('button', { name: /ITEM-001/i })).toBeVisible()
  })

  it('selects an option and closes the menu', async () => {
    const onChange = vi.fn()
    render(
      <SearchableSelect
        value=""
        options={['ITEM-001', 'ITEM-002']}
        onChange={onChange}
        placeholder="Pilih item..."
      />,
    )

    const trigger = screen.getByRole('button', { name: /pilih item/i })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'ITEM-002' }))

    expect(onChange).toHaveBeenCalledWith('ITEM-002', expect.objectContaining({ value: 'ITEM-002' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
