

# Gerar Mockups PNG do ProduzAI v2.0

## Resumo
Criar 3 imagens PNG de alta qualidade simulando as telas propostas no novo design system: Instalações (lista + sheet lateral), Ocorrências (lista + sheet lateral) e Cards de Campanha (estilo limpo sem gradientes).

## O que será gerado

### Mockup 1 — Instalações (Lista + Sheet)
- Sidebar escura à esquerda
- KPI strip no topo (Total, Concluídas, Pendentes, Com Ocorrência)
- Tabela de linhas com: barra de status 3px, nome da loja, cidade/UF, data, equipe, badge de status, thumbnails de fotos
- Sheet lateral aberto (480px) mostrando detalhes de uma instalação com seções organizadas
- Fundo #F8F7F4, cards #FFFFFF, tipografia Inter

### Mockup 2 — Ocorrências (Lista + Sheet)
- Sidebar escura à esquerda
- KPI strip com hierarquia (total grande 32px, status menores 20px)
- Pills de filtro por status no topo
- Tabela com: badge prioridade, badge status, loja, motivo truncado, data, resolução prevista
- Sheet lateral com campos editáveis organizados por seções

### Mockup 3 — Cards de Campanha
- Sidebar escura à esquerda
- Grid de cards brancos com border sutil e shadow leve
- Borda esquerda colorida de 3px como identidade
- Cada card: nome da campanha, data, badge de status, métricas (N lojas, N peças), link "Acessar"
- Sem gradientes, sem cores fortes como fundo

## Abordagem técnica
- Usar o AI Gateway com modelo de geração de imagem (`google/gemini-3-pro-image-preview`) para gerar cada mockup
- Prompts detalhados descrevendo cada tela com as especificações exatas do design system v2.0
- Output em `/mnt/documents/` como PNGs para download

## Entregáveis
- `mockup_instalacoes_v2.png`
- `mockup_ocorrencias_v2.png`
- `mockup_campanhas_v2.png`

