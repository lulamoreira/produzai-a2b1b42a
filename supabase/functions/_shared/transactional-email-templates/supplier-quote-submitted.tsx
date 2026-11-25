/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const BRAND = '#8C6F4E'
const DARK = '#1C1916'

interface Props {
  supplierName?: string
  contactName?: string
  agencyName?: string
  clientName?: string
  campaignName?: string
  isNegotiation?: boolean
  submittedAt?: string
  production?: string
  installation?: string
  freight?: string
  discount?: string
  total?: string
  itemsCount?: number
  internalUrl?: string
  portalUrl?: string
}

const Row = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <tr>
      <td style={tdLabel}>{label}</td>
      <td style={tdValue}>{value}</td>
    </tr>
  ) : null

const Email = (p: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{`${p.supplierName || 'Fornecedor'} concluiu a cotação — ${p.campaignName || ''}`}</Preview>
    <Body style={main}>
      <Section style={header}><Text style={headerText}>{(p.campaignName || 'Campanha').toUpperCase()}</Text></Section>
      <Container style={container}>
        <Heading style={h1}>
          {p.isNegotiation ? 'Proposta de negociação enviada' : 'Cotação concluída'}
        </Heading>
        <Text style={text}>
          <strong>{p.supplierName || 'Fornecedor'}</strong>
          {p.contactName ? ` (${p.contactName})` : ''} concluiu o preenchimento
          {p.isNegotiation ? ' da negociação' : ' da cotação'} da campanha <strong>{p.campaignName}</strong>
          {p.clientName ? ` — ${p.clientName}` : ''}.
        </Text>
        <table cellPadding={0} cellSpacing={0} width="100%" style={table}>
          <tbody>
            <Row label="Enviado em" value={p.submittedAt} />
            <Row label="Itens cotados" value={p.itemsCount != null ? String(p.itemsCount) : undefined} />
            <Row label="Produção" value={p.production} />
            <Row label="Instalação" value={p.installation} />
            <Row label="Frete / Embalagem" value={p.freight} />
            <Row label="Desconto" value={p.discount} />
            <Row label="Total da cotação" value={p.total} />
          </tbody>
        </table>
        {p.internalUrl && (
          <Section style={cta}><Button style={button} href={p.internalUrl}>Abrir cotações da campanha</Button></Section>
        )}
        {p.portalUrl && (
          <Text style={small}>Cotação do fornecedor: <a href={p.portalUrl} style={{ color: BRAND }}>{p.portalUrl}</a></Text>
        )}
        <Hr style={hr} />
        <Text style={small}>Aviso automático do ProduzAI{p.agencyName ? ` — ${p.agencyName}` : ''}.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `✅ ${d.supplierName || 'Fornecedor'} concluiu a ${d.isNegotiation ? 'negociação' : 'cotação'} — ${d.campaignName || 'Campanha'}`,
  to: 'producao@vimer.com.br',
  displayName: 'Cotação concluída pelo fornecedor (aviso interno)',
  previewData: {
    supplierName: 'Pigma', contactName: 'Ana', agencyName: 'Vimer', clientName: 'Lindt BR',
    campaignName: 'Natal 2026', submittedAt: '25/11/2026 10:30', itemsCount: 238,
    production: 'R$ 600.000,00', installation: 'R$ 30.000,00', freight: 'R$ 16.455,21',
    discount: 'R$ 0,00', total: 'R$ 646.455,21',
    internalUrl: 'https://produzai.lovable.app', portalUrl: 'https://produzai.lovable.app/fornecedor/x',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const header = { backgroundColor: DARK, padding: '14px 24px', textAlign: 'center' as const }
const headerText = { color: '#ffffff', fontSize: '15px', fontWeight: 'bold' as const, margin: '0' }
const container = { padding: '28px 24px 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const table = { borderCollapse: 'collapse' as const, margin: '0 0 20px', border: '1px solid #e5e5e5' }
const tdLabel = { fontSize: '13px', color: '#666666', padding: '8px 12px', border: '1px solid #e5e5e5', width: '45%' }
const tdValue = { fontSize: '13px', color: DARK, fontWeight: 'bold' as const, padding: '8px 12px', border: '1px solid #e5e5e5' }
const cta = { textAlign: 'center' as const, margin: '4px 0 16px' }
const button = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', borderRadius: '6px' }
const small = { fontSize: '12px', color: '#777777', lineHeight: '1.5', margin: '0 0 8px', wordBreak: 'break-all' as const }
const hr = { borderColor: '#e5e5e5', margin: '20px 0 12px' }
