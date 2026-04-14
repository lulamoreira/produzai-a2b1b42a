/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ProduzAI'
const BRAND = '#8C6F4E'

interface SupplierInviteProps {
  contactName?: string
  companyName?: string
  agencyName?: string
  campaignName?: string
  portalUrl?: string
  deadline?: string
}

const SupplierInviteEmail = ({
  contactName = 'Fornecedor',
  companyName = '',
  agencyName = '',
  campaignName = 'Campanha',
  portalUrl = '#',
  deadline,
}: SupplierInviteProps) => {
  const deadlineDate = deadline ? new Date(deadline) : null
  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)
    : null
  const deadlineStr = deadlineDate
    ? deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null
  const isUrgent = daysLeft != null && daysLeft <= 3

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Convite para cotação — {campaignName}</Preview>
      <Body style={main}>
        {/* Branded header */}
        <Section style={header}>
          <Text style={headerText}>{agencyName || SITE_NAME}</Text>
        </Section>

        <Container style={container}>
          <Heading style={h1}>Convite para Cotação</Heading>

          <Text style={text}>
            Olá, <strong>{contactName}</strong>!
          </Text>

          <Text style={text}>
            A <strong>{agencyName}</strong> está convidando a{' '}
            <strong>{companyName}</strong> para participar do processo de
            cotação da campanha <strong>{campaignName}</strong>.
          </Text>

          <Text style={text}>
            Para acessar a planilha de cotação e preencher seus preços,
            siga as instruções abaixo:
          </Text>

          <Section style={stepsBox}>
            <Text style={stepItem}>
              <strong>1.</strong> Acesse o link abaixo para abrir o portal de cotação
            </Text>
            <Text style={stepItem}>
              <strong>2.</strong> Preencha o preço unitário de cada peça/kit
            </Text>
            <Text style={stepItem}>
              <strong>3.</strong> Informe os valores de instalação e frete
            </Text>
            <Text style={stepItem}>
              <strong>4.</strong> Clique em <strong>ENVIAR</strong> quando concluir a cotação
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={portalUrl}>
              ACESSAR COTAÇÃO
            </Button>
          </Section>

          {deadlineStr && (
            <Section style={deadlineBox}>
              <Text style={isUrgent ? deadlineTextUrgent : deadlineTextNormal}>
                ⏰ Prazo para envio: <strong>{deadlineStr}</strong>
                {isUrgent && daysLeft != null && (
                  <span> — {daysLeft <= 0 ? 'HOJE!' : `faltam ${daysLeft} dia${daysLeft > 1 ? 's' : ''}!`}</span>
                )}
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            Este convite foi enviado pela plataforma {SITE_NAME} em nome da{' '}
            <strong>{agencyName}</strong>. Se você recebeu este email por
            engano, por favor desconsidere.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SupplierInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data.campaignName || 'Campanha'} — Convite para Cotação`,
  displayName: 'Convite para fornecedor',
  previewData: {
    contactName: 'João Silva',
    companyName: 'Gráfica Express',
    agencyName: 'Studio Design',
    campaignName: 'Campanha Verão 2026',
    portalUrl: 'https://example.com/orcamento/abc123',
    deadline: new Date(Date.now() + 2 * 86400000).toISOString(),
  },
} satisfies TemplateEntry

// ─── Styles ──────────────────────────────────────────────
const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const header = {
  backgroundColor: BRAND,
  padding: '20px 24px',
  textAlign: 'center' as const,
}
const headerText = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 'bold' as const,
  margin: '0',
  letterSpacing: '0.5px',
}
const container = { padding: '28px 24px 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const stepsBox = {
  backgroundColor: '#f9f7f5',
  borderLeft: `4px solid ${BRAND}`,
  padding: '16px 20px',
  margin: '0 0 24px',
  borderRadius: '4px',
}
const stepItem = { fontSize: '14px', color: '#333333', lineHeight: '1.8', margin: '0' }
const ctaSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const ctaButton = {
  backgroundColor: BRAND,
  color: '#ffffff',
  padding: '14px 32px',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  borderRadius: '6px',
  display: 'inline-block',
}
const deadlineBox = {
  backgroundColor: '#fef9f0',
  border: '1px solid #f0e0c8',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
}
const deadlineTextNormal = { fontSize: '14px', color: '#6b5937', margin: '0' }
const deadlineTextUrgent = { fontSize: '14px', color: '#dc2626', fontWeight: 'bold' as const, margin: '0' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '0' }
