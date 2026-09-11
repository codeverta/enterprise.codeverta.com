import { fireEvent, render, screen } from '@testing-library/react'
import { Box } from 'lucide-react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import Sidebar from './Sidebar'
import { LanguageProvider, useLanguage } from '@/context/LanguageContext'

vi.mock('../store/useReportStore', () => ({
  default: () => ({ newReportsCount: 0 }),
}))

vi.mock('../store/useSettingsStore', () => ({
  useSettingsStore: () => ({ settings: {}, fetchSettings: vi.fn() }),
}))

vi.mock('./dashboard/NotificationBell', () => ({ default: () => null }))
vi.mock('./dashboard/SystemSettings', () => ({ default: () => null }))
vi.mock('./RightSidebar', () => ({ default: () => null }))
vi.mock('./AppSwitcherMenu', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

function LanguageSwitch() {
  const { setLanguage } = useLanguage()
  return <button type="button" onClick={() => setLanguage('en')}>Use English</button>
}

describe('Sidebar language coverage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('translates labels reactively without changing their routes', () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <LanguageSwitch />
          <Sidebar
            user={{ role: 99 }}
            onLogout={vi.fn()}
            isOpen
            onToggle={vi.fn()}
            items={[{ name: 'Orders', href: '/orders', icon: Box }]}
          />
        </MemoryRouter>
      </LanguageProvider>,
    )

    expect(screen.getByRole('link', { name: 'Pesanan' })).toHaveAttribute('href', '/dashboard/orders')

    fireEvent.click(screen.getByRole('button', { name: 'Use English' }))

    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/dashboard/orders')
  })
})
