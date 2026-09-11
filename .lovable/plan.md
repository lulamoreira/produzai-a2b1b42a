# Importação de peças e kits por PDF do OneNote

## Objetivo
Adicionar uma segunda origem ao importador do OneNote: o usuário escolhe Excel ou PDF, revisa e corrige todas as linhas extraídas, e somente então confirma a mesma importação já usada hoje.

## Experiência no app
1. Ao clicar em **Importar do OneNote**, abrir uma escolha entre **Arquivo Excel** e **PDF do OneNote**.
2. Excel mantém o comportamento atual, passando a usar a mesma conferência editável antes da confirmação.
3. PDF aceita apenas `.pdf`, extrai no navegador o texto de cada página e preserva linhas e marcadores de página.
4. Se não houver texto legível, explicar que o arquivo parece ser uma imagem e pedir um PDF de impressão do OneNote.
5. Durante a análise, mostrar progresso e permitir nova tentativa em caso de falha.
6. Exibir uma tabela de conferência editável com as seis colunas atuais, remoção e inclusão de linhas, contagem de peças/kits e agrupamento resumido por kit.
7. Nenhum dado é gravado antes da confirmação explícita.

## Implementação
- Extrair a leitura de PDF para um helper cliente baseado em `pdfjs-dist`, configurando o worker compatível com o Vite e reconstruindo linhas pela posição vertical dos itens.
- Manter `transformOneNoteRows` como fonte única para converter as seis colunas em `OneNoteParsedPiece`.
- Evoluir o diálogo atual para receber linhas brutas editáveis, recalcular o preview através de `transformOneNoteRows` e reutilizar sem mudanças a inserção existente de peças, kits, vínculos, localizações e desambiguação.
- Adicionar a função `onenote-pdf-extract`, protegendo a chave no backend, validando entrada e saída e retornando mensagens claras do gateway.
- Dividir textos grandes no cliente em blocos com sobreposição contextual de seção/página, processar sequencialmente e juntar as linhas antes da revisão.
- Aplicar o prompt estrito `{ rows: [...] }`, validar exatamente as seis chaves e normalizar valores para texto antes de devolver ao app.
- Tratar `400/401/402/403` como falhas finais e `429/5xx` com tentativas limitadas e espera; preservar a mensagem útil para o usuário.

## Validação
- Testes do agrupamento de texto do PDF, transformação das linhas e validação do retorno da IA.
- Verificar manualmente: PDF com texto, PDF sem camada de texto, edição/adição/remoção na conferência, divisão Primária/Secundária e confirmação final.
- Implantar e invocar a nova função com uma amostra real para confirmar o contrato do gateway.
- Conferir o app em desktop e celular, o resultado da compilação e os registros de execução.
- Publicar ao final, conforme solicitado.

## Limites
- Não haverá OCR para PDFs de imagem.
- Não será criada tela de login nem nova lógica de persistência.
- Os demais importadores e regras de peças/kits permanecerão inalterados.
