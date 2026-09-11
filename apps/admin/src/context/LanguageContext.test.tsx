import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { LanguageProvider, useLanguage } from './LanguageContext'
import { getNavigationLabel } from '@/lib/navigation-i18n'

function LanguageConsumer() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div>
      <output data-testid="language">{language}</output>
      <output data-testid="orders">{getNavigationLabel(t, 'Orders')}</output>
      <output data-testid="unknown">{getNavigationLabel(t, 'Future Menu')}</output>
      <output data-testid="module">
        {t('navigation.module', { values: { name: getNavigationLabel(t, 'Orders') } })}
      </output>
      <button type="button" onClick={() => setLanguage('en')}>English</button>
    </div>
  )
}

describe('LanguageProvider navigation translations', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('lang')
  })

  it('uses Indonesian by default and preserves unknown menu labels', () => {
    render(<LanguageProvider><LanguageConsumer /></LanguageProvider>)

    expect(screen.getByTestId('language')).toHaveTextContent('id')
    expect(screen.getByTestId('orders')).toHaveTextContent('Pesanan')
    expect(screen.getByTestId('unknown')).toHaveTextContent('Future Menu')
    expect(screen.getByTestId('module')).toHaveTextContent('Modul: Pesanan')
    expect(document.documentElement).toHaveAttribute('lang', 'id-ID')
  })

  it('updates every consumer and persists the selected language', () => {
    render(<LanguageProvider><LanguageConsumer /></LanguageProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'English' }))

    expect(screen.getByTestId('language')).toHaveTextContent('en')
    expect(screen.getByTestId('orders')).toHaveTextContent('Orders')
    expect(screen.getByTestId('module')).toHaveTextContent('Module: Orders')
    expect(localStorage.getItem('appLanguage')).toBe('en')
    expect(document.documentElement).toHaveAttribute('lang', 'en-US')
  })
})
