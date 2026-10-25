'use strict';

/* C.O.D.E. — E2E spec para Integração P2: Movimentações → Dashboard.
   Objetivo: validar o oráculo dashboard-movimento que fornece dados
   resumidos do ledger de movimentações no formato adequado ao painel.
   Referências: e2e/oracles/dashboard-movimento.js,
   e2e/oracles/movement.js, e2e/oracles/balance.js */

const { test, expect } = require('@playwright/test');

test.describe('Phase 2 — Integração Movimentações → Dashboard', () => {
  beforeEach(() => {
    return page.evaluate(() => localStorage.clear());
  });

  test('ledgerDashboardSummary: retorna count/inflow/outflow/net e rows', async ({ page }) => {
    // Arrange
    await page.evaluate(() => {
      const entries = [
        { id: 'e1', desc: 'Depósito inicial', type: 'in', amount: '1000.00', date: '2024-01-01' },
        { id: 'e2', desc: 'Compra mercado', type: 'out', amount: '250.50', date: '2024-01-02' },
        { id: 'e3', desc: 'Salário', type: 'in', amount: '5000.00', date: '2024-01-10' },
        { id: 'e4', desc: 'Aluguel', type: 'out', amount: '1500.00', date: '2024-01-15' }
      ];
      localStorage.setItem('entries', JSON.stringify(entries));
    });

    // Act
    const result = await page.evaluate(() => {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]');
      return window.ledgerDashboardSummary(entries);
    });

    // Assert
    expect(result).toHaveProperty('count');
    expect(result).toHaveProperty('inflow');
    expect(result).toHaveProperty('outflow');
    expect(result).toHaveProperty('net');
    expect(result.count).toBe(4);
    expect(result.inflow).toBeCloseTo(6000.00); // 1000 + 5000
    expect(result.outflow).toBeCloseTo(1750.50); // 250.50 + 1500
    expect(result.net).toBeCloseTo(4249.50); // 6000 - 1750.50
    expect(Array.isArray(result.rows)).toBe(true);
    expect(result.rows.length).toBe(4);
  });

  test('patrimonioComMovimentacao: combina banks + pockets + investments + entries', async ({ page }) => {
    // Arrange
    await page.evaluate(() => {
      const entries = [
        { id: 'e1', desc: 'Depósito', type: 'in', amount: '1000.00', date: '2024-01-01' }
      ];
      localStorage.setItem('entries', JSON.stringify(entries));
      // banks, pockets, investments vazio/preenchido conforme teste
    });

    // Act
    const result = await page.evaluate(() => {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]');
      return window.patrimonioComMovimentacao({ banks: [], pockets: [], investments: [] });
    });

    // Assert
    expect(result).toBeTypeOf('number');
    expect(result).toBeCloseTo(1000.00);
  });

  test('entradasPorTipo: conta entrada/saída/total', async ({ page }) => {
    // Arrange
    await page.evaluate(() => {
      const entries = [
        { id: 'e1', desc: 'Depósito', type: 'in', amount: '1000.00', date: '2024-01-01' },
        { id: 'e2', desc: 'Saída', type: 'out', amount: '250.50', date: '2024-01-02' }
      ];
      localStorage.setItem('entries', JSON.stringify(entries));
    });

    // Act
    const result = await page.evaluate(() => {
      const entries = JSON.parse(localStorage.getItem('entries') || '[]');
      return window.entradasPorTipo(entries);
    });

    // Assert
    expect(result).toHaveProperty('inflow');
    expect(result).toHaveProperty('outflow');
    expect(result).toHaveProperty('total');
    expect(result.inflow).toBe(1);
    expect(result.outflow).toBe(1);
    expect(result.total).toBe(2);
  });

  test('entriesByDescription: filtra entradas por descrição', async ({ page }) => {
    // Arrange
    await page.evaluate(() => {
      const entries = [
        { id: 'e1', desc: 'Depósito', type: 'in', amount: '1000.00', date: '2024-01-01' },
        { id: 'e2', desc: 'Depósito', type: 'in', amount: '500.00', date: '2024-01-02' },
        { id: 'e3', desc: 'Aluguel', type: 'out', amount: '1500.00', date: '2024-01-15' }
      ];
      localStorage.setItem('entries', JSON.stringify(entries));
    });

    // Act
    const result = await page.evaluate(
      (desc) => {
        const entries = JSON.parse(localStorage.getItem('entries') || '[]');
        return window.entriesByDescription(entries, desc);
      },
      'Depósito'
    );

    // Assert
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2); // duas entradas com desc "Depósito"
    result.forEach((e) => expect(e.desc).toBe('Depósito'));
  });
});