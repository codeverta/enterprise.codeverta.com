import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'

import { ModuleLauncher } from './index'

const expectedAccountingModules = [
  'Invoicing',
  'Payments',
  'Financial Reports',
  'Accounts Setup',
  'Taxes',
  'Banking',
  'Budget',
  'Share Management',
  'Subscription',
]

function CurrentLocation() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}{location.search}</output>
}

describe('Desk accounting module dialog', () => {
  it('opens from the Accounting card and shows all requested modules', async () => {
    render(
      <MemoryRouter initialEntries={['/desk']}>
        <ModuleLauncher user={{ display_name: 'Admin' }} onSearchOpen={vi.fn()} />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Akuntansi & Keuangan.*Buka modul/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Akuntansi & Keuangan' })
    expect(within(dialog).getByText('9 submodul tersedia')).toBeInTheDocument()
    expectedAccountingModules.forEach((name) => {
      expect(within(dialog).getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible()
    })
  })

  it('closes the dialog and navigates to the selected module URL', async () => {
    render(
      <MemoryRouter initialEntries={['/desk']}>
        <ModuleLauncher user={{ display_name: 'Admin' }} onSearchOpen={vi.fn()} />
        <CurrentLocation />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Akuntansi & Keuangan.*Buka modul/i }))
    const dialog = await screen.findByRole('dialog', { name: 'Akuntansi & Keuangan' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^Invoicing/ }))

    expect(screen.queryByRole('dialog', { name: 'Akuntansi & Keuangan' })).not.toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('/desk/invoicing?sidebar=Invoicing')
  })
})
