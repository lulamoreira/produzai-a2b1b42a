/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ProduzAI'
const BRAND = '#8C6F4E'

interface TimelineEntry {
  entry_date: string
  description: string
}

interface SupplierInviteProps {
  contactName?: string
  companyName?: string
  agencyName?: string
  clientName?: string
  campaignName?: string
  portalUrl?: string
  deadline?: string
  timelineEntries?: TimelineEntry[]
  locale?: 'pt-BR' | 'es-CL'
}

const SupplierInviteEmail = ({
  contactName = 'Fornecedor',
  companyName = '',
  agencyName = '',
  clientName = '',
  campaignName = 'Campanha',
  portalUrl = '#',
  deadline,
  timelineEntries = [],
  locale = 'pt-BR',
}: SupplierInviteProps) => {

  const deadlineDate = deadline ? new Date(deadline) : null
  const daysLeft = deadlineDate
    ? Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)
    : null
  const deadlineStr = deadlineDate
    ? deadlineDate.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null
  
  const translations = {
    'pt-BR': {
      subject: `Convite para cotação — ${campaignName}`,
      heading: 'Convite para Cotação',
      greeting: 'Olá',
      intro_a: 'A',
      intro_b: 'está convidando a',
      intro_c: 'para participar do processo de cotação da campanha',
      instructions: 'Para acessar a planilha de cotação e preencher seus preços, siga as instruções abaixo:',
      step1: 'Acesse o link abaixo para abrir o portal de cotação',
      step2: 'Preencha o preço unitário de cada peça/kit',
      step3: 'Informe os valores de instalação e frete',
      step4: 'Clique em ENVIAR quando concluir a cotação',
      cta: 'ACESSAR COTAÇÃO',
      deadline: 'Prazo para envio',
      today: 'HOJE!',
      missing_days: (d: number) => `faltam ${d} dia${d > 1 ? 's' : ''}!`,
      timeline_title: 'Cronograma da Campanha',
      timeline_acceptance: '⚠ Ao preencher e enviar o orçamento, você confirma o aceite deste cronograma.',
      footer_sent_by: 'Este convite foi enviado pela plataforma',
      footer_on_behalf: 'em nome da',
      footer_disregard: 'Se você recebeu este email por engano, por favor desconsidere.',
    },
    'es-CL': {
      subject: `Invitación a cotizar — ${campaignName}`,
      heading: 'Invitación a Cotizar',
      greeting: 'Hola',
      intro_a: 'La agencia',
      intro_b: 'ha invitado a',
      intro_c: 'a participar en el proceso de cotización de la campaña',
      instructions: 'Para acceder a la planilla de cotización y completar sus precios, siga las instrucciones abajo:',
      step1: 'Acceda al link abajo para abrir el portal de cotización',
      step2: 'Complete el precio unitario de cada ítem/kit',
      step3: 'Informe los valores de instalación y flete',
      step4: 'Haga clic en ENVIAR al concluir la cotización',
      cta: 'ACCEDER A COTIZACIÓN',
      deadline: 'Plazo de envío',
      today: '¡HOY!',
      missing_days: (d: number) => `faltan ${d} día${d > 1 ? 's' : ''}!`,
      timeline_title: 'Cronograma de la Campaña',
      timeline_acceptance: '⚠ Al completar y enviar el presupuesto, usted confirma la aceptación de este cronograma.',
      footer_sent_by: 'Esta invitación fue enviada por la plataforma',
      footer_on_behalf: 'en nombre de',
      footer_disregard: 'Si recibió este correo por error, por favor desconsidérelo.',
    }
  }[locale]

  const isUrgent = daysLeft != null && daysLeft <= 3

  return (
    <Html lang={locale === 'es-CL' ? 'es-CL' : 'pt-BR'} dir="ltr">
      <Head />
      <Preview>{translations.subject}</Preview>
      <Body style={main}>
        {/* Branded header */}
        <Section style={header}>
          <Text style={headerText}>{agencyName || SITE_NAME}</Text>
        </Section>

        <Container style={container}>
          <Heading style={h1}>{translations.heading}</Heading>

          <Text style={text}>
            {translations.greeting}, <strong>{contactName}</strong>!
          </Text>

          <Text style={text}>
            {translations.intro_a} <strong>{agencyName}</strong> {translations.intro_b}{' '}
            <strong>{companyName}</strong> {translations.intro_c} <strong>{campaignName}</strong>.
          </Text>

          {clientName && (
            <Section style={clientBox}>
              <Text style={clientLabel}>{locale === 'es-CL' ? 'CLIENTE' : 'CLIENTE'}</Text>
              <Text style={clientNameStyle}>{clientName.toUpperCase()}</Text>
            </Section>
          )}


          <Text style={text}>
            {translations.instructions}
          </Text>

          <Section style={stepsBox}>
            <Text style={stepItem}>
              <strong>1.</strong> {translations.step1}
            </Text>
            <Text style={stepItem}>
              <strong>2.</strong> {translations.step2}
            </Text>
            <Text style={stepItem}>
              <strong>3.</strong> {translations.step3}
            </Text>
            <Text style={stepItem}>
              <strong>4.</strong> {translations.step4}
            </Text>
          </Section>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={portalUrl}>
              {translations.cta}
            </Button>
          </Section>

          {deadlineStr && (
            <Section style={deadlineBox}>
              <Text style={isUrgent ? deadlineTextUrgent : deadlineTextNormal}>
                ⏰ {translations.deadline}: <strong>{deadlineStr}</strong>
                {isUrgent && daysLeft != null && (
                  <span> — {daysLeft <= 0 ? translations.today : translations.missing_days(daysLeft)}</span>
                )}
              </Text>
            </Section>
          )}

          {timelineEntries && timelineEntries.length > 0 && (
            <Section style={timelineBox}>
              <Text style={timelineTitle}>📅 {translations.timeline_title}</Text>
              {timelineEntries.map((entry, i) => (
                <Text key={i} style={timelineItem}>
                  <strong>
                    {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString(locale)}
                  </strong>
                  {' — '}
                  {entry.description}
                </Text>
              ))}
              <Text style={timelineAcceptance}>
                {translations.timeline_acceptance}
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          <Text style={footer}>
            {translations.footer_sent_by} {SITE_NAME} {translations.footer_on_behalf}{' '}
            <strong>{agencyName}</strong>. {translations.footer_disregard}
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
    timelineEntries: [
      { entry_date: '2026-05-01', description: 'Aprovação da arte final' },
      { entry_date: '2026-05-10', description: 'Início da produção' },
      { entry_date: '2026-05-25', description: 'Entrega nas lojas' },
    ],
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
const timelineBox = {
  backgroundColor: '#f9f7f5',
  borderLeft: `4px solid ${BRAND}`,
  padding: '16px 20px',
  margin: '0 0 24px',
  borderRadius: '4px',
}
const timelineTitle = {
  fontSize: '15px',
  fontWeight: 'bold' as const,
  color: '#1a1a1a',
  margin: '0 0 12px',
}
const timelineItem = {
  fontSize: '14px',
  color: '#333333',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const timelineAcceptance = {
  fontSize: '13px',
  color: '#b91c1c',
  fontWeight: 'bold' as const,
  lineHeight: '1.5',
  margin: '12px 0 0',
  paddingTop: '12px',
  borderTop: '1px solid #e5d8c8',
}
