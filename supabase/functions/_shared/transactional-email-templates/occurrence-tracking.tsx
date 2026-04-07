import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface OccurrenceTrackingProps {
  campaignName?: string
  publicUrl?: string
  storeName?: string
}

const OccurrenceTrackingEmail = ({
  campaignName = 'Campanha',
  publicUrl = '#',
  storeName,
}: OccurrenceTrackingProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Acompanhe sua ocorrência - {campaignName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Acompanhe sua Ocorrência</Heading>

        <Text style={text}>Olá{storeName ? `, ${storeName}` : ''}!</Text>

        <Text style={text}>
          Recebemos o registro da sua ocorrência na campanha <strong>{campaignName}</strong>.
          Você pode acompanhar o andamento e todas as atualizações em tempo real pelo link abaixo:
        </Text>

        <Section style={{ textAlign: 'center' as const, marginTop: '25px' }}>
          <Button href={publicUrl} style={button}>
            📋 Acompanhar Ocorrência
          </Button>
        </Section>

        <Text style={textSmall}>
          Caso haja qualquer movimentação, você será notificado automaticamente por e-mail.
        </Text>

        <Hr style={hr} />
        <Text style={footer}>Este é um email automático do ProduzAI.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OccurrenceTrackingEmail,
  subject: (data: Record<string, any>) =>
    `Acompanhe a sua ocorrência da Campanha "${data.campaignName || 'Campanha'}"`,
  displayName: 'Link de Acompanhamento de Ocorrência',
  previewData: {
    campaignName: 'Pistache',
    publicUrl: 'https://produzai.lovable.app/ocorrencia/123',
    storeName: 'Loja Centro',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#6366f1', borderBottom: '2px solid #6366f1', paddingBottom: '10px', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333', lineHeight: '1.6', margin: '0 0 15px' }
const textSmall = { fontSize: '13px', color: '#666', lineHeight: '1.5', marginTop: '20px' }
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
