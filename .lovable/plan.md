## Pré-validação e diagnóstico de erros na execução de grupos de automação

Hoje, ao clicar em "Executar grupo", o sistema roda cada automação salva em sequência. Se algum problema ocorrer (peça apagada, kit sem componentes, campo customizado removido, erro do banco), o usuário só vê um toast genérico tipo `Erro de execução: …` sem saber qual automação falhou nem como resolver. As únicas opções são desativar o item no grupo ou apagar o template — sem visibilidade do que está quebrado.

### O que será feito

**1. Pré-checagem antes de executar (novo diálogo de revisão)**

Ao clicar em "Executar grupo", abre primeiro um novo diálogo `GroupRunReviewDialog` que valida cada automação habilitada do grupo e mostra:

- ✅ Automações OK (prontas para rodar)
- ⚠️ Automações com problemas detectados, listando para cada item problemático:
  - **Peça apagada** — item referencia `pieceId` que não existe mais em `pieces`
  - **Kit apagado** — item referencia `kitId` que não existe mais em `kits`
  - **Kit sem componentes** — kit existe mas `kitPieces` está vazio (causa do warning atual)
  - **Campo de filtro customizado removido** — `custom_field_X` não está mais configurado no cliente
  - **Campo base numérico removido** — em modo `by_field`, o campo `base_field` não existe mais nas lojas
  - **Sem lojas correspondentes ao filtro** — alerta informativo

**2. Ações de recuperação por item problemático**

Para cada problema, o usuário poderá:

- **Substituir item** — abre um seletor de peças/kits válidos para trocar a referência inválida (atualiza `template.items` no banco)
- **Remover item da automação** — tira só o item problemático mantendo o resto da automação
- **Desativar automação no grupo** — atalho para o `toggleGroupItem` existente (não roda essa automação agora, mas mantém)
- **Editar automação** — abre o template no modo de edição para o usuário ajustar manualmente
- **Ignorar e continuar mesmo assim** — opção para forçar execução com risco de erro

**3. Diálogo de erro detalhado em caso de falha durante a execução**

Mesmo após a revisão, se algum erro ocorrer no banco durante o run (ex.: violação de FK, erro de rede), em vez do toast curto:

- Abre `GroupRunErrorDialog` mostrando:
  - Nome da automação que falhou
  - Mensagem do erro do banco (legível, com tradução de erros comuns como FK violation → "peça referenciada não existe mais")
  - Quantas automações executaram com sucesso antes da falha
  - Botão "Revisar grupo" (reabre o `GroupRunReviewDialog`)
  - Botão "Fechar"

**4. Resiliência durante a execução**

- O loop de execução do grupo passa a coletar erros por automação em vez de abortar tudo no primeiro erro.
- Ao final, mostra resumo: "X automações executadas, Y com erro" com lista das que falharam.
- Cada falha vai para o `GroupRunErrorDialog` com detalhes.

### Arquivos afetados

- `src/components/MatrixAutomationDialog.tsx` — interceptar `handleRunGroup` para abrir o diálogo de revisão; coletar erros em vez de abortar.
- `src/components/Matrix/GroupRunReviewDialog.tsx` (novo) — UI de pré-validação e ações de recuperação.
- `src/components/Matrix/GroupRunErrorDialog.tsx` (novo) — UI de erro detalhado pós-execução.
- `src/hooks/useAutomationTemplates.ts` — usar o `updateTemplate` existente para persistir substituições/remoções de itens; nenhuma mudança de schema necessária.

### Sem alterações no banco

Tudo é validação no cliente usando os dados já carregados (`pieces`, `kits`, `kitPieces`, `clients` para campos customizados, `stores` para campos numéricos). Persistência usa as mutations já existentes.

### Fluxo visual

```text
[Botão "Executar grupo"]
        ↓
[GroupRunReviewDialog] ─── tudo OK ──→ executa direto
        │
        └── há problemas ──→ usuário corrige/desativa/ignora
                                    ↓
                          [Confirma execução]
                                    ↓
                        executa cada automação
                                    ↓
              ┌──── tudo OK ──→ toast de sucesso
              │
              └── erros ──→ [GroupRunErrorDialog com detalhes]
```
