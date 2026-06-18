/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ProduzAI'
const BRAND = '#8C6F4E'

interface Contact {
  nome?: string
  funcao?: string
  email?: string
  telefone?: string
  whatsapp?: string
}

interface FileItem {
  name?: string
  url?: string
}

interface Props {
  contactName?: string
  companyName?: string
  agencyName?: string
  editUrl?: string
  expiresAt?: string
  supplier?: {
    company_name?: string
    cnpj?: string
    contact_name?: string
    phone?: string
    whatsapp?: string
    email?: string
    website?: string
    address?: string
    cep?: string
    logradouro?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    estado?: string
    services?: string[]
    contacts?: Contact[]
    file_urls?: FileItem[]
    observations?: string
  }
}

const Row = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null
  return (
    <Text style={rowText}>
      <strong style={labelStyle}>{label}:</strong> {value}
    </Text>
  )
}

const Email = ({
  contactName = 'Fornecedor',
  companyName = '',
  agencyName = '',
  editUrl = '#',
  expiresAt,
  supplier = {},
}: Props) => {
  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

  const fullAddress = [
    supplier.logradouro,
    supplier.numero,
    supplier.complemento,
    supplier.bairro,
    supplier.cidade && supplier.estado ? `${supplier.cidade}/${supplier.estado}` : supplier.cidade || supplier.estado,
    supplier.cep,
  ].filter(Boolean).join(', ') || supplier.address || ''

  const services = (supplier.services || []).filter(Boolean)
  const contacts = (supplier.contacts || []).filter(c => c && (c.nome || c.email || c.telefone))

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>Confirme seus dados cadastrais — {companyName}</Preview>
      <Body style={main}>
        <Section style={header}>
          <Text style={headerText}>{agencyName || SITE_NAME}</Text>
        </Section>

        <Container style={container}>
          <Heading style={h1}>Confirmação de Dados Cadastrais</Heading>

          <Text style={text}>Olá, <strong>{contactName}</strong>!</Text>

          <Text style={text}>
            A <strong>{agencyName}</strong> mantém um cadastro da sua empresa como fornecedor <strong>{companyName}</strong> em
            nossa plataforma. Por favor, confira abaixo se todas as informações estão corretas.
            Caso precise atualizar qualquer dado, clique no botão ao final do e-mail.
          </Text>

          <Section style={dataBox}>
            <Text style={sectionTitle}>🏢 Empresa</Text>
            <Row label="Razão Social" value={supplier.company_name} />
            <Row label="CNPJ" value={supplier.cnpj} />
            <Row label="Website" value={supplier.website} />

            {fullAddress && (
              <>
                <Text style={sectionTitle}>📍 Endereço</Text>
                <Text style={rowText}>{fullAddress}</Text>
              </>
            )}

            <Text style={sectionTitle}>📞 Contato Principal</Text>
            <Row label="Nome" value={supplier.contact_name} />
            <Row label="E-mail" value={supplier.email} />
            <Row label="Telefone" value={supplier.phone} />
            <Row label="WhatsApp" value={supplier.whatsapp} />

            {contacts.length > 0 && (
              <>
                <Text style={sectionTitle}>👥 Demais Contatos</Text>
                {contacts.map((c, i) => (
                  <Section key={i} style={contactBlock}>
                    <Row label="Nome" value={c.nome} />
                    <Row label="Função" value={c.funcao} />
                    <Row label="E-mail" value={c.email} />
                    <Row label="Telefone" value={c.telefone} />
                    <Row label="WhatsApp" value={c.whatsapp} />
                  </Section>
                ))}
              </>
            )}

            {services.length > 0 && (
              <>
                <Text style={sectionTitle}>🛠 Serviços</Text>
                <Text style={rowText}>{services.join(' • ')}</Text>
              </>
            )}

            {supplier.observations && (
              <>
                <Text style={sectionTitle}>📝 Observações</Text>
                <Text style={rowText}>{supplier.observations}</Text>
              </>
            )}
          </Section>

          <Section style={ctaSection}>
            <Button style={ctaButton} href={editUrl}>
              CONFERIR E ATUALIZAR MEUS DADOS
            </Button>
          </Section>

          <Text style={deadlineText}>
            🔓 Este link de edição é <strong>eterno</strong>. Guarde este e-mail e use-o sempre que precisar atualizar seus dados.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Se todas as informações estiverem corretas, você não precisa fazer nada.
            Este e-mail foi enviado pela plataforma {SITE_NAME} em nome da <strong>{agencyName}</strong>.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Confirme seus dados cadastrais — ${data.companyName || 'Fornecedor'}`,
  displayName: 'Confirmação de dados do fornecedor',
  previewData: {
    contactName: 'João Silva',
    companyName: 'Gráfica Express',
    agencyName: 'Studio Design',
    editUrl: 'https://example.com/convite/fornecedor/abc123',
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    supplier: {
      company_name: 'Gráfica Express LTDA',
      cnpj: '12.345.678/0001-90',
      contact_name: 'João Silva',
      email: 'joao@grafica.com',
      phone: '(11) 98765-4321',
      whatsapp: '(11) 98765-4321',
      website: 'https://grafica.com',
      cep: '01310-100',
      logradouro: 'Av. Paulista',
      numero: '1000',
      bairro: 'Bela Vista',
      cidade: 'São Paulo',
      estado: 'SP',
      services: ['Marcenaria', 'Impressão Digital', 'Cenografia'],
      contacts: [
        { nome: 'Maria Souza', funcao: 'Gerente Comercial', email: 'maria@grafica.com', telefone: '(11) 91234-5678' },
      ],
      observations: 'Atende em todo Brasil.',
    },
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Segoe UI', Arial, sans-serif" }
const header = { backgroundColor: BRAND, padding: '20px 24px', textAlign: 'center' as const }
const headerText = { color: '#ffffff', fontSize: '18px', fontWeight: 'bold' as const, margin: '0', letterSpacing: '0.5px' }
const container = { padding: '28px 24px 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const dataBox = {
  backgroundColor: '#f9f7f5',
  borderLeft: `4px solid ${BRAND}`,
  padding: '16px 20px',
  margin: '0 0 24px',
  borderRadius: '4px',
}
const sectionTitle = {
  fontSize: '14px',
  fontWeight: 'bold' as const,
  color: BRAND,
  margin: '16px 0 8px',
}
const rowText = { fontSize: '13px', color: '#333333', lineHeight: '1.6', margin: '0 0 4px' }
const labelStyle = { color: '#6b5937' }
const contactBlock = {
  borderTop: '1px dashed #d8c8b8',
  padding: '8px 0 0',
  margin: '8px 0 0',
}
const ctaSection = { textAlign: 'center' as const, margin: '0 0 16px' }
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
const deadlineText = { fontSize: '13px', color: '#6b5937', textAlign: 'center' as const, margin: '0 0 16px' }
const hr = { borderColor: '#e5e5e5', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#999999', lineHeight: '1.5', margin: '0' }
