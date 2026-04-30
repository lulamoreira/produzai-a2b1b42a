/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ProduzAI'
const BRAND = '#8C6F4E'
const DARK = '#1C1916'
const BEIGE = '#F7F3EC'
const RED = '#dc2626'
const GREEN = '#16a34a'

interface SupplierRow {
  name: string
  status: string
  totalFormatted: string
  installationFormatted: string
  freightFormatted: string
  submittedAt: string | null
}

interface DownloadLink {
  name: string
  url: string
}

interface BudgetResultsProps {
  clientName?: string
  agencyName?: string
  campaignName?: string
  bestSupplier?: { name: string; total: number; totalFormatted: string }
  budgetAmount?: number | null
  budgetAmountFormatted?: string | null
  difference?: number | null
  differenceFormatted?: string | null
  suppliers?: SupplierRow[]
  deadline?: string | null
  currencyCode?: string
  downloadUrls?: DownloadLink[]
}

const BudgetResultsEmail = ({
  clientName = 'Cliente',
  agencyName = '',
  campaignName = 'Campanha',
  bestSupplier,
  budgetAmountFormatted,
  difference,
  differenceFormatted,
  suppliers = [],
  deadline,
  downloadUrls = [],
}: BudgetResultsProps) => {
  const submitted = suppliers.filter((s) => s.status === 'enviado')
  const deadlineDate = deadline ? new Date(deadline) : null
  const deadlineStr = deadlineDate
    ? deadlineDate.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null
  const diffColor = difference != null && difference > 0 ? RED : GREEN

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>
        Resultado da cotação — {campaignName}
      </Preview>
      <Body style={main}>
        {/* Dark header */}
        <Section style={headerDark}>
          <Text style={headerDarkText}>{agencyName || SITE_NAME}</Text>
        </Section>

        {/* Brown subheader */}
        <Section style={headerBrown}>
          <Text style={headerBrownText}>{(campaignName || '').toUpperCase()}</Text>
        </Section>

        <Container style={container}>
          <Heading style={h1}>Resultado da Cotação</Heading>

          <Text style={text}>Prezado(a) <strong>{clientName}</strong>,</Text>

          <Text style={text}>
            <strong>{agencyName}</strong> conclui o processo de cotação da campanha{' '}
            <strong>{campaignName}</strong> e apresenta o resultado abaixo.
          </Text>

          {/* KPI cards */}
          <table cellPadding={0} cellSpacing={0} width="100%" style={kpiTable}>
            <tbody>
              <tr>
                <td style={kpiCellLeft}>
                  <div style={kpiLabel}>Orçamento Previsto</div>
                  <div style={kpiValue}>{budgetAmountFormatted || 'Não definido'}</div>
                </td>
                <td style={kpiCellMid}>
                  <div style={kpiLabel}>Melhor Proposta</div>
                  <div style={kpiValue}>{bestSupplier?.totalFormatted || '—'}</div>
                  {bestSupplier?.name && (
                    <div style={kpiSub}>{bestSupplier.name}</div>
                  )}
                </td>
                <td style={kpiCellRight}>
                  <div style={kpiLabel}>Diferença</div>
                  <div style={{ ...kpiValue, color: diffColor }}>
                    {differenceFormatted || '—'}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Suppliers table */}
          {submitted.length > 0 && (
            <>
              <Heading as="h2" style={h2}>Fornecedores Participantes</Heading>
              <table cellPadding={0} cellSpacing={0} width="100%" style={dataTable}>
                <thead>
                  <tr>
                    <th style={th}>Fornecedor</th>
                    <th style={thRight}>Total</th>
                    <th style={thRight}>Instalação</th>
                    <th style={thRight}>Frete</th>
                    <th style={th}>Enviado em</th>
                  </tr>
                </thead>
                <tbody>
                  {submitted.map((s, i) => {
                    const isWinner = bestSupplier?.name === s.name
                    const rowStyle = isWinner
                      ? rowWinner
                      : i % 2 === 0 ? rowEven : rowOdd
                    const cellFont = isWinner ? { color: '#ffffff', fontWeight: 'bold' as const } : {}
                    return (
                      <tr key={i} style={rowStyle}>
                        <td style={{ ...td, ...cellFont }}>
                          {isWinner && '🏆 '}{s.name}
                        </td>
                        <td style={{ ...tdRight, ...cellFont }}>{s.totalFormatted}</td>
                        <td style={{ ...tdRight, ...cellFont }}>{s.installationFormatted}</td>
                        <td style={{ ...tdRight, ...cellFont }}>{s.freightFormatted}</td>
                        <td style={{ ...td, ...cellFont }}>{s.submittedAt || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}

          {deadlineStr && (
            <Section style={deadlineBox}>
              <Text style={deadlineText}>
                ⏰ O prazo dado aos fornecedores foi: <strong>{deadlineStr}</strong>
              </Text>
            </Section>
          )}

          {bestSupplier?.name && (
            <Section style={winnerBox}>
              <Text style={winnerText}>
                🏆 Após análise das propostas, o fornecedor{' '}
                <strong>{bestSupplier.name}</strong> apresentou a melhor proposta.
                Já iniciamos contato para negociação e aguardamos sua decisão para
                seguirmos com a próxima etapa do processo.
              </Text>
            </Section>
          )}

          {downloadUrls.length > 0 && (
            <>
              <Heading as="h2" style={h2}>Planilhas para Download</Heading>
              {downloadUrls.map((d, i) => (
                <Section key={i} style={ctaSection}>
                  <Button style={ctaButton} href={d.url}>
                    📥 {d.name}
                  </Button>
                </Section>
              ))}
              <Text style={smallNote}>
                Os links de download ficam ativos por 30 dias.
              </Text>
            </>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Este relatório foi gerado pela plataforma {SITE_NAME} em nome da{' '}
            <strong>{agencyName}</strong>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: BudgetResultsEmail,
  subject: (data: Record<string, any>) =>
    `${data.campaignName || 'Campanha'} — Resultado da Cotação`,
  displayName: 'Resultado da cotação para o cliente',
  previewData: {
    clientName: 'Maria Silva',
    agencyName: 'Studio Design',
    campaignName: 'Campanha Verão 2026',
    bestSupplier: { name: 'Gráfica Express', total: 12500, totalFormatted: 'R$ 12.500,00' },
    budgetAmount: 15000,
    budgetAmountFormatted: 'R$ 15.000,00',
    difference: -2500,
    differenceFormatted: '-R$ 2.500,00',
    suppliers: [
      { name: 'Gráfica Express', status: 'enviado', totalFormatted: 'R$ 12.500,00', installationFormatted: 'R$ 800,00', freightFormatted: 'R$ 400,00', submittedAt: '28/04/2026 14:32' },
      { name: 'Print House', status: 'enviado', totalFormatted: 'R$ 13.800,00', installationFormatted: 'R$ 900,00', freightFormatted: 'R$ 500,00', submittedAt: '29/04/2026 09:15' },
    ],
    deadline: new Date(Date.now() - 86400000).toISOString(),
    currencyCode: 'BRL',
    downloadUrls: [
      { name: 'Orçamento - Gráfica Express.xlsx', url: 'https://example.com/a.xlsx' },
      { name: 'Comparativo de Preços.xlsx', url: 'https://example.com/b.xlsx' },
    ],
  },
} satisfies TemplateEntry

// ─── Styles ──────────────────────────────────────────────
const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const headerDark = { backgroundColor: DARK, padding: '14px 24px', textAlign: 'center' as const }
const headerDarkText = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '0.5px' }
const headerBrown = { backgroundColor: BRAND, padding: '14px 24px', textAlign: 'center' as const }
const headerBrownText = { color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '1px' }
const container = { padding: '28px 24px 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 20px' }
const h2 = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '24px 0 12px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const smallNote = { fontSize: '12px', color: '#777777', textAlign: 'center' as const, margin: '4px 0 16px' }

const kpiTable = { margin: '8px 0 8px', borderCollapse: 'separate' as const, borderSpacing: '8px 0' }
const kpiCellBase = { backgroundColor: BEIGE, border: `1px solid #e5d8c8`, borderRadius: '6px', padding: '14px 12px', textAlign: 'center' as const, width: '33%', verticalAlign: 'top' as const }
const kpiCellLeft = { ...kpiCellBase }
const kpiCellMid = { ...kpiCellBase, backgroundColor: '#fef9f0' }
const kpiCellRight = { ...kpiCellBase }
const kpiLabel = { fontSize: '11px', color: '#6b5937', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 6px', fontWeight: 'bold' as const }
const kpiValue = { fontSize: '18px', color: DARK, fontWeight: 'bold' as const, margin: '0' }
const kpiSub = { fontSize: '11px', color: '#666666', margin: '4px 0 0' }

const dataTable = { borderCollapse: 'collapse' as const, margin: '0 0 16px', border: '1px solid #e5e5e5' }
const th = { backgroundColor: BRAND, color: '#ffffff', fontSize: '12px', fontWeight: 'bold' as const, padding: '10px 8px', textAlign: 'left' as const, border: '1px solid #d4c2a8' }
const thRight = { ...th, textAlign: 'right' as const }
const td = { fontSize: '13px', color: '#333333', padding: '8px', border: '1px solid #e5e5e5', textAlign: 'left' as const }
const tdRight = { ...td, textAlign: 'right' as const }
const rowEven = { backgroundColor: '#ffffff' }
const rowOdd = { backgroundColor: BEIGE }
const rowWinner = { backgroundColor: BRAND }

const deadlineBox = { backgroundColor: '#fef9f0', border: '1px solid #f0e0c8', borderRadius: '6px', padding: '12px 16px', margin: '0 0 16px', textAlign: 'center' as const }
const deadlineText = { fontSize: '13px', color: '#6b5937', margin: '0' }

const winnerBox = { backgroundColor: '#f9f7f5', borderLeft: `4px solid ${BRAND}`, padding: '14px 18px', margin: '0 0 20px', borderRadius: '4px' }
const winnerText = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0' }

const ctaSection = { textAlign: 'center' as const, margin: '0 0 10px' }
const ctaButton = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', borderRadius: '6px', display: 'inline-block' }

const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '0' }
