/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ProduzAI'
const BRAND = '#8C6F4E'
const DARK = '#4A2C2A'
const GOLD = '#C5A55A'

interface DownloadLink { name: string; url: string }

interface NegotiationProposalProps {
  supplierName?: string
  contactName?: string
  agencyName?: string
  clientName?: string
  campaignName?: string
  totalOriginalFormatted?: string
  totalNegotiatedFormatted?: string
  differenceFormatted?: string
  differenceDirection?: 'up' | 'down' | 'none'
  downloadUrls?: DownloadLink[]
}

const NegotiationProposalEmail = ({
  supplierName = 'Fornecedor',
  contactName,
  agencyName = '',
  clientName = '',
  campaignName = 'Campanha',
  totalOriginalFormatted = '',
  totalNegotiatedFormatted = '',
  differenceFormatted = '',
  differenceDirection = 'none',
  downloadUrls = [],
}: NegotiationProposalProps) => {
  const greeting = contactName || supplierName
  const diffLabel =
    differenceDirection === 'up'
      ? 'Diferença (para maior)'
      : differenceDirection === 'down'
      ? 'Diferença (para menor)'
      : 'Diferença'
  const diffColor =
    differenceDirection === 'up' ? '#2F855A' : differenceDirection === 'down' ? '#C53030' : '#555555'
  const diffPrefix =
    differenceDirection === 'up' ? '+' : differenceDirection === 'down' ? '-' : ''
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Proposta negociada — {clientName ? `${clientName} · ` : ''}{campaignName}</Preview>
      <Body style={main}>
        <Section style={headerDark}>
          <Text style={headerDarkText}>{agencyName || SITE_NAME}</Text>
        </Section>
        <Section style={headerBrown}>
          <Text style={headerBrownText}>PROPOSTA NEGOCIADA</Text>
        </Section>

        <Container style={container}>
          <Heading style={h1}>📑 Proposta Negociada</Heading>

          <Text style={text}>Prezado(a) <strong>{greeting}</strong>,</Text>

          {clientName && (
            <Section style={clientBox}>
              <Text style={clientLabel}>Cliente</Text>
              <Text style={clientName_}>{clientName}</Text>
            </Section>
          )}

          <Text style={text}>
            Conforme nossa negociação para a campanha <strong>{campaignName}</strong>,
            segue em anexo a proposta com os valores acordados.
          </Text>

          {(totalOriginalFormatted || totalNegotiatedFormatted) && (
            <Section style={summaryBox}>
              {totalOriginalFormatted && (
                <Text style={summaryLine}>
                  Valor Original: <strong>{totalOriginalFormatted}</strong>
                </Text>
              )}
              {totalNegotiatedFormatted && (
                <Text style={summaryLine}>
                  Valor Negociado: <strong>{totalNegotiatedFormatted}</strong>
                </Text>
              )}
              {differenceFormatted && differenceDirection !== 'none' && (
                <Text style={{ ...savingsLine, color: diffColor }}>
                  {diffLabel}: <strong>{diffPrefix}{differenceFormatted}</strong>
                </Text>
              )}
            </Section>
          )}

          {downloadUrls.length > 0 && (
            <>
              <Heading as="h2" style={h2}>📎 Arquivos</Heading>
              {downloadUrls.map((d, i) => (
                <Section key={i} style={ctaSection}>
                  <Button style={ctaButton} href={d.url}>
                    📥 Baixar {d.name}
                  </Button>
                </Section>
              ))}
              <Text style={smallNote}>Este arquivo ficará disponível por 30 dias.</Text>
            </>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Atenciosamente,<br />
            Equipe <strong>{agencyName || SITE_NAME}</strong>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: NegotiationProposalEmail,
  subject: (data: Record<string, any>) =>
    `📑 ${data.clientName ? `${data.clientName} · ` : ''}${data.campaignName || 'Campanha'} — Proposta Negociada`,
  displayName: 'Proposta negociada ao fornecedor',
  previewData: {
    supplierName: 'Gráfica Express',
    contactName: 'João Silva',
    agencyName: 'Studio Design',
    clientName: 'Cliente Exemplo',
    campaignName: 'Campanha Verão 2026',
    totalOriginalFormatted: 'R$ 480.000,00',
    totalNegotiatedFormatted: 'R$ 449.500,00',
    differenceFormatted: 'R$ 30.500,00',
    differenceDirection: 'down',
    downloadUrls: [{ name: 'Proposta_Negociada.xlsx', url: 'https://example.com/file.xlsx' }],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const headerDark = { backgroundColor: DARK, padding: '14px 24px', textAlign: 'center' as const }
const headerDarkText = { color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '0.5px' }
const headerBrown = { backgroundColor: BRAND, padding: '14px 24px', textAlign: 'center' as const }
const headerBrownText = { color: '#ffffff', fontSize: '16px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '1px' }
const container = { padding: '28px 24px 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 20px' }
const h2 = { fontSize: '16px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '24px 0 12px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const summaryBox = { border: `2px solid ${GOLD}`, borderRadius: '6px', padding: '14px 18px', margin: '8px 0 20px', backgroundColor: '#fffdf7' }
const summaryLine = { fontSize: '14px', color: '#333333', margin: '0 0 6px', lineHeight: '1.5' }
const savingsLine = { fontSize: '15px', color: '#2F855A', margin: '8px 0 0', lineHeight: '1.5', fontWeight: 'bold' as const }
const ctaSection = { textAlign: 'center' as const, margin: '4px 0 12px' }
const ctaButton = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', borderRadius: '6px', display: 'inline-block' }
const smallNote = { fontSize: '12px', color: '#888888', textAlign: 'center' as const, margin: '8px 0 0', fontStyle: 'italic' as const }
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#555555', lineHeight: '1.6', margin: '0' }
