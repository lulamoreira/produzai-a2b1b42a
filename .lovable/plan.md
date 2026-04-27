## Objetivo

Permitir que usuários autorizados registrem manualmente o **Check-in** (chegada) e **Check-out** (saída) do instalador em cada loja, diretamente no card da aba **Instalações**, para casos em que o instalador não possui celular ou meio digital próprio. Cada registro grava **data/hora** e **quem fez** o lançamento.

## Regras

- **Check-in manual** e **Check-out manual** são ações **sempre disponíveis**, mesmo que o card esteja **bloqueado** (lock). Igualmente, **upload de fotos** e o **check-in fotográfico** continuam liberados em cards bloqueados (essas três ações nunca são bloqueáveis).
- Demais campos do card continuam respeitando o lock atual.
- Quem pode acionar: qualquer usuário com permissão de edição da campanha (mesma regra do botão "Marcar como concluída"). Admin/Master sempre podem.
- O **check-out** só pode ser feito se houver **check-in** registrado (manual ou via GPS do app do instalador).
- Cada ação pode ser **desfeita** por Admin/Master (botão pequeno "desfazer"), com confirmação. Reabertura registra log.
- Toda ação grava em `activity_logs` (log do card) e em `campaign_activity_log` (histórico global da campanha) com nome do usuário.

## Banco de dados (migration)

Adicionar colunas na tabela `campaign_schedules`:

- `manual_checkin_at timestamptz`
- `manual_checkin_by uuid` (referência lógica a `auth.users.id`, sem FK)
- `manual_checkin_by_name text` (snapshot do nome para histórico)
- `manual_checkout_at timestamptz`
- `manual_checkout_by uuid`
- `manual_checkout_by_name text`

Sem CHECK constraints (regra de "checkout exige checkin" é validada no client + log). RLS existente da tabela já cobre.

## UI — Card de Instalação (`src/components/InstallationsTab.tsx`)

Adicionar uma nova seção no corpo expandido do card, logo abaixo do bloco "Check-in de fotos para ocorrências" e antes de "CÓDIGO DE ACESSO":

```text
REGISTRO MANUAL DE PRESENÇA
┌──────────────────────────────────────────────────────────┐
│  [▶ Registrar Check-in]   [■ Registrar Check-out]        │
│                                                          │
│  ✔ Check-in manual: 27/04/2026 às 09:14 por João Silva   │
│  ✔ Check-out manual: 27/04/2026 às 17:22 por João Silva  │
│  ⏱ Duração: 8h 08min                                     │
└──────────────────────────────────────────────────────────┘
```

Comportamento:
- Botão **Check-in**: desabilitado se `manual_checkin_at` (ou `checkin_timestamp` GPS) já existir. Ao clicar → confirma → grava `manual_checkin_at = now()`, `manual_checkin_by = user.id`, `manual_checkin_by_name = display_name`. Toast + invalidate.
- Botão **Check-out**: desabilitado enquanto não houver check-in (manual OU GPS). Após click → grava `manual_checkout_at`, etc.
- Linhas de status mostram nome + data/hora formatada (`dd/MM/yyyy 'às' HH:mm`).
- Pequeno ícone "↺ desfazer" ao lado de cada linha, visível só para Admin/Master, com `confirm()` antes de limpar os campos.
- Se houver **check-in GPS** do instalador, exibir junto na mesma seção como informativo ("Check-in via app: …") para evitar duplicidade de registro.

A seção inteira ignora `isCardLocked` (renderiza e os botões funcionam mesmo bloqueado), seguindo a regra do enunciado.

## Indicador no cabeçalho do card (linha colapsada)

Acrescentar, ao lado do indicador de check-in existente (linha "Row 3"), uma marca curta quando houver check-out:

`✔ Check-out 27/04 17:22`

Pinta em verde se duração ≥ 30min, neutro caso contrário.

## Filtros e dashboard

- Adicionar opção no filtro "Check-in" existente: `Sem check-out` (lojas com check-in mas sem check-out registrado).
- KPI opcional no `CampaignStatusDashboard`: contagem de instalações **em andamento** (com check-in e sem check-out). Implementação simples; pode ser entregue numa segunda iteração se preferir.

## Logs

Para cada ação:
- `activity_logs` (log do card): `action: "manual_checkin" | "manual_checkout" | "manual_checkin_undone" | "manual_checkout_undone"`, com detalhe textual.
- `campaign_activity_log` (histórico global): descrição "Fulano registrou check-in manual em LOJA X às 09:14".

## Tipos

Atualizar `src/types/schedule.ts` adicionando os 6 campos novos (opcionais, nullables) ao tipo `Schedule`. `types.ts` do Supabase é regenerado automaticamente.

## Arquivos afetados

- **Migration nova** em `supabase/migrations/` — adiciona as 6 colunas.
- **Edita** `src/types/schedule.ts` — adiciona campos.
- **Edita** `src/components/InstallationsTab.tsx` — nova seção no card, indicador no cabeçalho, opção de filtro.
- (Opcional) **Edita** `src/components/CampaignStatusDashboard.tsx` — KPI "Em andamento".

## Fora do escopo

- Não altera fluxo do app/portal do instalador (GPS check-in segue como está).
- Não altera lógica de bloqueio dos demais campos do card.
- Não cria relatório dedicado; valores ficam visíveis no card e exportáveis numa próxima iteração se solicitado.