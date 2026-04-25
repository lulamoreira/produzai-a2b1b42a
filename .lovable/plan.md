## Padronização do contador "(X peças)" no Rateio

Atualmente o cabeçalho das colunas do Rateio tem inconsistência visual entre peças e kits:

- **Kits** exibem 4 linhas: imagem → código → "(X pçs)" → nome
- **Peças** exibem 3 linhas: imagem → código → nome

Isso faz o nome das peças ficar verticalmente mais alto que o nome dos kits, mesmo com `align-top`, quebrando o alinhamento horizontal entre colunas vizinhas. Além disso, o estilo do "(X pçs)" usa `font-bold` (mais pesado que o resto do cabeçalho).

### O que será alterado

Em `src/pages/CampaignDetail.tsx`, dentro do header das colunas do Rateio:

1. **Reservar espaço equivalente nas colunas de peças** — adicionar uma linha invisível (`invisible`, `aria-hidden`) com a mesma altura do "(X pçs)" do kit, para que o nome de peças e kits fique sempre na mesma linha vertical, em qualquer largura.
2. **Padronizar o peso da fonte** do contador do kit para `font-semibold` (em vez de `font-bold`), mantendo destaque mas em harmonia com o código (que já é `font-bold`) e com o nome (que é `font-normal muted`).
3. **Garantir o mesmo `leading-tight` e `gap-0.5`** já aplicados, para que o espaçamento vertical seja idêntico entre as duas colunas.

### Resultado visual

```text
Coluna PEÇA          Coluna KIT
┌──────────┐         ┌──────────┐
│  [img]   │         │  [img]   │
│   001    │         │   002    │
│  (vazio) │  ←──→   │ (2 pçs)  │   ← mesma linha
│  Nome    │         │  Nome    │   ← mesma linha
└──────────┘         └──────────┘
```

Sem alterações de lógica de negócio, apenas ajustes visuais no cabeçalho da tabela do Rateio.
