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

interface TimelineEntry {
  date: string // already formatted dd/MM/yyyy
  description: string
}

interface SupplierWinnerProps {
  supplierName?: string
  contactName?: string
  agencyName?: string
  campaignName?: string
  mockupUrl?: string
  bookUrl?: string
  timeline?: TimelineEntry[]
  locale?: 'pt-BR' | 'es-CL'
}

const SupplierWinnerEmail = ({
  supplierName = 'Fornecedor',
  contactName,
  agencyName = '',
  campaignName = 'Campanha',
  mockupUrl,
  bookUrl,
  timeline = [],
  locale = 'pt-BR',
}: SupplierWinnerProps) => {
  const greeting = contactName || supplierName

  const translations = {
    'pt-BR': {
      subject: `🏆 ${campaignName || 'Campanha'} — Você venceu o certame!`,
      preview: `Parabéns! Você venceu o certame — ${campaignName}`,
      h1: '🏆 Parabéns, você venceu o certame!',
      intro_1: 'É com satisfação que comunicamos que',
      intro_2: 'foi selecionado(a) como fornecedor vencedor da cotação para a campanha',
      intro_3: '. A partir de agora seguiremos com as próximas etapas do processo.',
      timeline_title: 'Cronograma da Campanha',
      th_date: 'Data',
      th_step: 'Etapa',
      mockup_title: '📦 Peças Fechadas (Mockup)',
      mockup_text: 'Acesse o link abaixo para baixar as peças fechadas do mockup, que serão a referência final para produção:',
      mockup_cta: '📥 Baixar peças do mockup',
      book_title: '📘 Book de Mockup',
      book_text: 'Acesse abaixo o book de mockup com a apresentação visual completa das peças:',
      book_cta: '📖 Baixar book de mockup',
      info_box: '✅ Solicitamos que confirme o recebimento deste e-mail e dê início à produção conforme o cronograma acima. Em caso de dúvidas, responda este e-mail diretamente.',
      footer_sent_by: 'Este comunicado foi enviado pela plataforma',
      footer_on_behalf: 'em nome da',
    },
    'es-CL': {
      subject: `🏆 ${campaignName || 'Campaña'} — ¡Usted venció la licitación!`,
      preview: `¡Felicitaciones! Usted venció la licitación — ${campaignName}`,
      h1: '🏆 ¡Felicitaciones, usted ganó la licitación!',
      intro_1: 'Es con satisfacción que comunicamos que',
      intro_2: 'ha sido seleccionado(a) como proveedor ganador de la cotización para la campaña',
      intro_3: '. A partir de ahora seguiremos con las próximas etapas del proceso.',
      timeline_title: 'Cronograma de la Campaña',
      th_date: 'Fecha',
      th_step: 'Etapa',
      mockup_title: '📦 Piezas Finales (Mockup)',
      mockup_text: 'Acceda al link abajo para descargar las piezas finales del mockup, que serán la referencia final para la producción:',
      mockup_cta: '📥 Descargar piezas del mockup',
      book_title: '📘 Book de Mockup',
      book_text: 'Acceda abajo al book de mockup con la presentación visual completa de las piezas:',
      book_cta: '📖 Descargar book de mockup',
      info_box: '✅ Solicitamos que confirme la recepción de este correo e inicie la producción según el cronograma anterior. En caso de dudas, responda a este correo directamente.',
      footer_sent_by: 'Este comunicado fue enviado por la plataforma',
      footer_on_behalf: 'en nombre de',
    }
  }[locale]

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Parabéns! Você venceu o certame — {campaignName}</Preview>
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
          <Heading style={h1}>🏆 Parabéns, você venceu o certame!</Heading>

          <Text style={text}>Olá <strong>{greeting}</strong>,</Text>

          <Text style={text}>
            É com satisfação que comunicamos que <strong>{supplierName}</strong> foi
            selecionado(a) como fornecedor vencedor da cotação para a campanha{' '}
            <strong>{campaignName}</strong>. A partir de agora seguiremos com as próximas
            etapas do processo.
          </Text>

          {timeline.length > 0 && (
            <>
              <Heading as="h2" style={h2}>📅 Cronograma da Campanha</Heading>
              <table cellPadding={0} cellSpacing={0} width="100%" style={dataTable}>
                <thead>
                  <tr>
                    <th style={thDate}>Data</th>
                    <th style={th}>Etapa</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((entry, i) => (
                    <tr key={i} style={i % 2 === 0 ? rowEven : rowOdd}>
                      <td style={tdDate}>{entry.date}</td>
                      <td style={td}>{entry.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {mockupUrl && (
            <>
              <Heading as="h2" style={h2}>📦 Peças Fechadas (Mockup)</Heading>
              <Text style={text}>
                Acesse o link abaixo para baixar as peças fechadas do mockup, que serão
                a referência final para produção:
              </Text>
              <Section style={ctaSection}>
                <Button style={ctaButton} href={mockupUrl}>
                  📥 Baixar peças do mockup
                </Button>
              </Section>
            </>
          )}

          {bookUrl && (
            <>
              <Heading as="h2" style={h2}>📘 Book de Mockup</Heading>
              <Text style={text}>
                Acesse abaixo o book de mockup com a apresentação visual completa das peças:
              </Text>
              <Section style={ctaSection}>
                <Button style={ctaButton} href={bookUrl}>
                  📖 Baixar book de mockup
                </Button>
              </Section>
            </>
          )}

          <Section style={infoBox}>
            <Text style={infoText}>
              ✅ Solicitamos que confirme o recebimento deste e-mail e dê início à
              produção conforme o cronograma acima. Em caso de dúvidas, responda este
              e-mail diretamente.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Este comunicado foi enviado pela plataforma {SITE_NAME} em nome da{' '}
            <strong>{agencyName}</strong>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupplierWinnerEmail,
  subject: (data: Record<string, any>) =>
    `🏆 ${data.campaignName || 'Campanha'} — Você venceu o certame!`,
  displayName: 'Notificação de fornecedor vencedor',
  previewData: {
    supplierName: 'Gráfica Express',
    contactName: 'João Silva',
    agencyName: 'Studio Design',
    campaignName: 'Campanha Verão 2026',
    mockupUrl: 'https://example.com/mockup.zip',
    bookUrl: 'https://example.com/book-mockup.pdf',
    timeline: [
      { date: '15/05/2026', description: 'Início da produção' },
      { date: '30/05/2026', description: 'Envio para os pontos de venda' },
      { date: '05/06/2026', description: 'Conclusão das instalações' },
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

const dataTable = { borderCollapse: 'collapse' as const, margin: '0 0 16px', border: '1px solid #e5e5e5' }
const th = { backgroundColor: BRAND, color: '#ffffff', fontSize: '12px', fontWeight: 'bold' as const, padding: '10px 12px', textAlign: 'left' as const, border: '1px solid #d4c2a8' }
const thDate = { ...th, width: '130px' }
const td = { fontSize: '13px', color: '#333333', padding: '10px 12px', border: '1px solid #e5e5e5', textAlign: 'left' as const }
const tdDate = { ...td, fontWeight: 'bold' as const, color: DARK, whiteSpace: 'nowrap' as const }
const rowEven = { backgroundColor: '#ffffff' }
const rowOdd = { backgroundColor: BEIGE }

const ctaSection = { textAlign: 'center' as const, margin: '4px 0 20px' }
const ctaButton = { backgroundColor: BRAND, color: '#ffffff', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', borderRadius: '6px', display: 'inline-block' }

const infoBox = { backgroundColor: '#f9f7f5', borderLeft: `4px solid ${BRAND}`, padding: '14px 18px', margin: '16px 0 20px', borderRadius: '4px' }
const infoText = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0' }

const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '0' }
