/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ProduzAI'
const BRAND = '#8C6F4E'
const DARK = '#1C1916'

interface DownloadLink { name: string; url: string }

interface AdjustmentFinalToClientProps {
  clientName?: string
  agencyName?: string
  campaignName?: string
  adjustmentName?: string
  downloadUrls?: DownloadLink[]
}

const AdjustmentFinalToClientEmail = ({
  clientName = 'Cliente',
  agencyName = '',
  campaignName = 'Campanha',
  adjustmentName = 'Ajuste',
  downloadUrls = [],
}: AdjustmentFinalToClientProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Planilha final e Guia Visual de Lojas — {campaignName}</Preview>
    <Body style={main}>
      <Section style={headerDark}>
        <Text style={headerDarkText}>{agencyName || SITE_NAME}</Text>
      </Section>
      <Section style={headerBrown}>
        <Text style={headerBrownText}>{(campaignName || '').toUpperCase()}</Text>
      </Section>

      <Container style={container}>
        <Heading style={h1}>Planilha final e Guia Visual de Lojas</Heading>

        <Text style={text}>Prezado(a) <strong>{clientName}</strong>,</Text>

        <Text style={text}>
          Estamos enviando a <strong>planilha final</strong> e o <strong>guia visual de lojas</strong>{' '}
          referentes à campanha <strong>{campaignName}</strong>
          {adjustmentName ? <> (ajuste <strong>{adjustmentName}</strong>)</> : null}.
        </Text>

        <Text style={text}>
          A planilha consolida os preços aprovados, o rateio por loja e o comparativo
          de valores. O guia visual apresenta loja a loja as peças e kits a serem
          produzidos, com fotos e quantidades.
        </Text>

        {downloadUrls.length > 0 && (
          <>
            <Heading as="h2" style={h2}>Arquivos para download</Heading>
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
          Enviado pela plataforma {SITE_NAME} em nome da <strong>{agencyName}</strong>.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdjustmentFinalToClientEmail,
  subject: (data: Record<string, any>) =>
    `${data.campaignName || 'Campanha'} — Planilha final e Guia Visual de Lojas`,
  displayName: 'Planilha final + Guia Visual ao cliente',
  previewData: {
    clientName: 'Maria Silva',
    agencyName: 'Studio Design',
    campaignName: 'Campanha Verão 2026',
    adjustmentName: 'Ajuste - 12/05/2026',
    downloadUrls: [
      { name: 'Planilha Final — Campanha Verão 2026.xlsx', url: 'https://example.com/a.xlsx' },
      { name: 'Guia Visual de Lojas — Campanha Verão 2026.pdf', url: 'https://example.com/b.pdf' },
    ],
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
const smallNote = { fontSize: '12px', color: '#777777', textAlign: 'center' as const, margin: '4px 0 16px' }
const ctaSection = { textAlign: 'center' as const, margin: '0 0 10px' }
const ctaButton = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', borderRadius: '6px', display: 'inline-block' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '0' }
