import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface OccurrenceNotificationProps {
  eventType?: 'created' | 'updated' | 'status_changed'
  date?: string
  clientName?: string
  campaignName?: string
  storeName?: string
  pieceName?: string
  motiveDesc?: string
  statusLabel?: string
  statusColor?: string
  description?: string
  publicUrl?: string
  // Overridable text from system_messages
  emailTitle?: string
  bannerText?: string
  footerText?: string
  buttonText?: string
  subjectText?: string
}

const OccurrenceNotificationEmail = ({
  eventType = 'created',
  date = '—',
  clientName = '—',
  campaignName = '—',
  storeName = '—',
  pieceName = '—',
  motiveDesc = '—',
  statusLabel,
  statusColor = '#6366f1',
  description,
  publicUrl,
  emailTitle = 'Sua ocorrência teve uma atualização',
  bannerText,
  footerText = 'Este é um email automático do ProduzAI.',
  buttonText = '📋 Visualizar Ocorrência',
}: OccurrenceNotificationProps) => {
  const defaultBanner = eventType === 'created'
    ? '🆕 Nova Ocorrência Registrada'
    : eventType === 'status_changed'
    ? `🔄 Status Atualizado para: ${statusLabel || '—'}`
    : '✏️ Ocorrência Atualizada'

  const resolvedBanner = bannerText || defaultBanner

  const bannerBg = eventType === 'created' ? '#dcfce7' : eventType === 'status_changed' ? '#dbeafe' : '#fef9c3'
  const bannerBorder = eventType === 'created' ? '#22c55e' : eventType === 'status_changed' ? '#3b82f6' : '#eab308'
  const bannerColor = eventType === 'created' ? '#166534' : eventType === 'status_changed' ? '#1e40af' : '#854d0e'

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{emailTitle} - {campaignName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{emailTitle}</Heading>

          <Section style={{ ...banner, backgroundColor: bannerBg, borderLeftColor: bannerBorder }}>
            <Text style={{ ...bannerText2, color: bannerColor }}>{resolvedBanner}</Text>
          </Section>

          <Section style={tableSection}>
            <Text style={row}>📅 <strong>Data:</strong> {date}</Text>
            <Text style={rowAlt}>🏢 <strong>Cliente:</strong> {clientName}</Text>
            <Text style={row}>📋 <strong>Campanha:</strong> {campaignName}</Text>
            <Text style={rowAlt}>🏪 <strong>Loja:</strong> {storeName}</Text>
            <Text style={row}>📦 <strong>Peça:</strong> {pieceName}</Text>
            <Text style={rowAlt}>⚠️ <strong>Motivo:</strong> {motiveDesc}</Text>
            {statusLabel && (
              <Text style={row}>🔵 <strong>Status:</strong> <span style={{ color: statusColor, fontWeight: 'bold' }}>{statusLabel}</span></Text>
            )}
            {description && (
              <Text style={rowAlt}>📝 <strong>Descrição:</strong> {description}</Text>
            )}
          </Section>

          {publicUrl && (
            <Section style={{ textAlign: 'center' as const, marginTop: '25px' }}>
              <Button href={publicUrl} style={button}>
                {buttonText}
              </Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={footer}>{footerText}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OccurrenceNotificationEmail,
  subject: (data: Record<string, any>) => data.subjectText || 'Sua ocorrência teve uma atualização',
  displayName: 'Notificação de Ocorrência',
  previewData: {
    eventType: 'created',
    date: '06/04/2026 10:30',
    clientName: 'Empresa Exemplo',
    campaignName: 'Campanha Pistache',
    storeName: 'Loja Centro',
    pieceName: 'Adesivo Vitrine',
    motiveDesc: 'Material danificado',
    statusLabel: 'Aberta',
    statusColor: '#6366f1',
    description: 'Adesivo com bolhas na vitrine principal',
    publicUrl: 'https://produzai.lovable.app/ocorrencia/123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#6366f1', borderBottom: '2px solid #6366f1', paddingBottom: '10px', margin: '0 0 20px' }
const banner = { borderLeft: '4px solid', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px' }
const bannerText2 = { margin: '0', fontWeight: 'bold' as const, fontSize: '14px' }
const tableSection = { marginTop: '15px' }
const row = { fontSize: '14px', color: '#333', padding: '8px 0', margin: '0' }
const rowAlt = { fontSize: '14px', color: '#333', padding: '8px 0', margin: '0', backgroundColor: '#f9f9f9' }
const button = {
  display: 'inline-block' as const,
  backgroundColor: '#6366f1',
  color: '#ffffff',
  padding: '14px 32px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
  fontSize: '14px',
}
const hr = { borderColor: '#e5e7eb', marginTop: '25px' }
const footer = { fontSize: '12px', color: '#999', marginTop: '10px' }
