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

interface AdjustmentQuoteRequestProps {
  supplierName?: string
  contactName?: string
  agencyName?: string
  campaignName?: string
  adjustmentName?: string
  changesDescription?: string
  customMessage?: string
  downloadUrls?: DownloadLink[]
}

const AdjustmentQuoteRequestEmail = ({
  supplierName = 'Fornecedor',
  contactName,
  agencyName = '',
  campaignName = 'Campanha',
  adjustmentName = 'Ajuste',
  changesDescription = '',
  customMessage,
  downloadUrls = [],
}: AdjustmentQuoteRequestProps) => {
  const greeting = contactName || supplierName
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Reorçamento pós-mockup — {campaignName}</Preview>
      <Body style={main}>
        <Section style={headerDark}>
          <Text style={headerDarkText}>{agencyName || SITE_NAME}</Text>
        </Section>
        <Section style={headerBrown}>
          <Text style={headerBrownText}>REORÇAMENTO PÓS-MOCKUP</Text>
        </Section>

        <Container style={container}>
          <Heading style={h1}>📐 Solicitação de Reorçamento</Heading>

          <Text style={text}>Prezado(a) <strong>{greeting}</strong>,</Text>

          <Text style={text}>
            Após a etapa de mockup da campanha <strong>{campaignName}</strong>, identificamos
            ajustes que impactam o escopo contratado. Segue em anexo a planilha de
            reorçamento referente ao ajuste <strong>{adjustmentName}</strong>
            {changesDescription ? <> com as alterações detalhadas: <strong>{changesDescription}</strong></> : null}.
          </Text>

          {customMessage && (
            <Section style={msgBox}>
              <Text style={msgText}>{customMessage}</Text>
            </Section>
          )}

          {downloadUrls.length > 0 && (
            <>
              <Heading as="h2" style={h2}>📎 Planilha de Reorçamento</Heading>
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

          <Section style={instructionsBox}>
            <Text style={instructionsText}>
              <strong>Por favor, preencha os campos destacados em amarelo na planilha</strong>
              {' '}e retorne com os novos valores propostos.
            </Text>
          </Section>

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
  component: AdjustmentQuoteRequestEmail,
  subject: (data: Record<string, any>) =>
    `📐 ${data.campaignName || 'Campanha'} — Reorçamento (${data.adjustmentName || 'Ajuste'})`,
  displayName: 'Reorçamento pós-mockup ao fornecedor',
  previewData: {
    supplierName: 'Gráfica Express',
    contactName: 'João Silva',
    agencyName: 'Studio Design',
    campaignName: 'Campanha Verão 2026',
    adjustmentName: 'Ajuste pós-mockup 01',
    changesDescription: '3 peças modificadas, 1 nova, 0 removidas',
    customMessage: 'Por gentileza priorizar essa cotação ainda esta semana.',
    downloadUrls: [{ name: 'Reorcamento.xlsx', url: 'https://example.com/file.xlsx' }],
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
const msgBox = { backgroundColor: '#f3f3f3', borderLeft: `4px solid ${GOLD}`, padding: '12px 16px', margin: '0 0 18px', borderRadius: '4px' }
const msgText = { fontSize: '13px', color: '#444444', margin: '0', fontStyle: 'italic' as const, whiteSpace: 'pre-wrap' as const }
const ctaSection = { textAlign: 'center' as const, margin: '4px 0 12px' }
const ctaButton = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', borderRadius: '6px', display: 'inline-block' }
const smallNote = { fontSize: '12px', color: '#888888', textAlign: 'center' as const, margin: '8px 0 0', fontStyle: 'italic' as const }
const instructionsBox = { backgroundColor: '#fffdf7', border: `2px solid ${GOLD}`, borderRadius: '6px', padding: '12px 16px', margin: '20px 0 8px' }
const instructionsText = { fontSize: '13px', color: DARK, margin: '0', lineHeight: '1.5' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '13px', color: '#555555', lineHeight: '1.6', margin: '0' }
