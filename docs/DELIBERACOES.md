# Deliberações com Planejamento Financeiro e Calendário

## Implementado

A nova tela `pages/deliberacoes.html` centraliza a primeira versão do fluxo.

1. PRESCON entra com seu perfil institucional.
2. Seleciona **Planejamento Financeiro** ou **Calendário**, informa título e envia o arquivo `.xlsx`, `.xls` ou `.ods` (até 4 MB).
3. O servidor valida extensão, assinatura e tamanho, calcula SHA-256 do arquivo inteiro, salva o **original sem converter** na pasta Google Drive privada e cria um formulário em estado **rascunho**.
4. A PRESCON abre a área de formulários, confere as perguntas, publica e acompanha as respostas. A planilha original é fonte documental; **os cenários e números não são extraídos nem interpretados automaticamente nesta primeira versão**. A PRESCON precisa conferir e adaptar as perguntas à planilha.
5. Após encerrar a votação e analisar todas as respostas pendentes, a PRESCON informa sua decisão e fundamentação, confirma explicitamente e solicita o relatório.
6. O servidor cria um **Google Docs privado** com identificação da deliberação, link do arquivo original, totais de votos, respostas aceitas por EJ, ressalvas e fundamentação da PRESCON.
7. O Apps Script, **após instalação e autorização pela conta Google da PRESCON**, atualiza duas abas gerenciadas da planilha **Painel Conselho 2026**:
   - `PRESCON_AUTOMACOES`: indicadores de demandas por EJ;
   - `PRESCON_DELIBERACOES`: título, tipo, situação, prazo e link do relatório final.

## Limites importantes

- A planilha enviada **não é interpretada automaticamente** em cenários financeiros ou datas de calendário. O portal não inventa dados a partir do arquivo. Próxima evolução: extração e prévia com confirmação explícita de mapeamento de abas e células.
- O relatório não é gerado no momento da criação: exige votação encerrada, respostas conferidas e decisão expressa da PRESCON.
- O relatório privado **não é compartilhado automaticamente** com o Conselho. Revisar antes de liberar o link.
- A sincronização do Painel Conselho 2026 **não foi executada na conta Google**; depende da instalação do Apps Script descrita em `docs/APPS-SCRIPT.md`.
- As abas existentes do Conselho não são modificadas. As novas abas do script são identificadas pelo seu ID interno; se já existir uma aba com o mesmo nome criada por outra pessoa, a rotina para em vez de sobrescrevê-la.
- O sistema ainda não escreve nas abas históricas preexistentes do Painel: isso requer o mapeamento e autorização da estrutura real.
- A conexão OAuth do Google precisa estar configurada no Supabase. Sem isso, o upload e a geração de Docs retornam erro em vez de fingir sucesso.
- Google Forms e Portal Forms são administrados na Central de Automações existente. A integração entre respostas precisa ser testada com contas autorizadas e casos reais antes de uso institucional.

## Segurança e testes

- Backend: `supabase/functions/prescon-workspace/index.ts`.
- Tabela privada: `public.prescon_deliberation_sources`, RLS habilitada e sem leitura para `anon`/`authenticated`.
- Testes estáticos: `scripts/check-deliberations.cjs` e `scripts/check-apps-script.cjs`, executados por GitHub Actions.
- Os testes estáticos não substituem o teste ponta a ponta com Google OAuth, upload real, votação e relatório. **Ainda não foi realizado um teste real com uma planilha enviada pela PRESCON**.
- Não há exigência de troca da senha de teste.
