# Integração Google Apps Script · Central PRESCON NEJLON

## Objetivo

Permitir que a PRESCON use a Central para organizar as demandas e, mesmo sem adesão do Conselho ao portal, a planilha **Painel Conselho 2026** receba automaticamente **indicadores resumidos por EJ**.

- Planilha original: [Painel Conselho 2026](https://docs.google.com/spreadsheets/d/1DdwqLHLDsHzD5dF344gKRtQSQMbhN-DplkqMc7z9sdI/edit).
- Área de configuração no portal: `pages/apps-script.html`.
- Projeto de Apps Script: `apps-script/Codigo.gs` e `apps-script/appsscript.json`.
- API: Supabase Edge Function `prescon-workspace`, endpoint `apps_script_snapshot`.

**Não é um Web App público.** O Apps Script é executado sob a conta Google da PRESCON, num projeto independente, privado e não compartilhado com o Conselho.

## Instalação inicial

1. Publique a Central no GitHub Pages (`main`, pasta raiz) e entre em **Apps Script** com seu perfil institucional PRESCON.
2. Clique em **Gerar chave de sincronização**. Copie a chave **uma única vez**. Ela é emitida por autenticação Supabase e permite somente consultar indicadores agregados.
3. Na conta Google que será responsável pela planilha, abra [Apps Script](https://script.google.com/home/projects/create) e crie um **projeto independente**. Não crie esse projeto dentro da planilha compartilhada, porque editores da planilha poderiam ter acesso ao código e às propriedades do projeto vinculado.
4. Cole o conteúdo de `apps-script/Codigo.gs` no editor. Habilite a visualização do manifesto e atualize o `appsscript.json` com o conteúdo versionado.
5. Em **Configurações do projeto → Propriedades do script**, crie:
   - `PRESCON_SYNC_TOKEN` → a chave copiada no portal.
   - `PRESCON_SHEET_ID` → `1DdwqLHLDsHzD5dF344gKRtQSQMbhN-DplkqMc7z9sdI`
6. Execute `instalarCentralPrescon`, concedendo acesso à planilha e às chamadas externas. Isso cria um gatilho de tempo, aproximadamente **a cada 6 horas**. Você pode executar `sincronizarResumoPrescon` manualmente quando quiser.
7. Abra a planilha e confira a aba `PRESCON_AUTOMACOES`. **Não altere o nome dessa aba** nem copie o projeto do Apps Script para colaboradores.
8. Para interromper, use **Revogar conexão** no portal. Para desligar também a execução agendada, execute `desativarCentralPrescon` no Apps Script.

## Quais dados são sincronizados?

O serviço só entrega:

- Nome da EJ;
- Quantidades de demandas abertas, pendentes, em andamento, justificadas, concluídas e vencidas;
- Contagem de EJs e formulários abertos;
- Data da consulta.

**Não inclui** conteúdo de voto, nome de quem votou, resposta individual, justificativa, prova, anexo, notas da PRESCON ou relatório confidencial.

O script modifica **somente** a aba `PRESCON_AUTOMACOES`; as demais abas, fórmulas, dashboards e históricos existentes permanecem intocados. Ele usa uma identificação interna da aba para não sobrescrever acidentalmente outra aba com o mesmo nome.

## Modelo de segurança

- O código do GitHub é público, mas **não contém a chave de sincronização**.
- Chave gerada por aleatoriedade criptográfica, guardada no Supabase **somente como hash SHA-256**.
- Chave válida por até 180 dias, com revogação imediata pela PRESCON.
- Até cinco conexões ativas por PRESCON.
- O backend verifica em cada consulta se a chave está ativa e se a PRESCON continua ativa.
- A chave **não autoriza** criação, edição ou exclusão de dados. O endpoint de leitura rejeita outros métodos.
- O Apps Script verifica o ID exato da planilha, a estrutura da resposta, os intervalos de valores e aplica tratamento contra injeção de fórmulas.
- O projeto do Apps Script deve permanecer **privado**, com as credenciais apenas nas Propriedades do script. Não enviar a chave por WhatsApp nem compartilhar o projeto com o Conselho.
- Não há bloqueio obrigatório nem política de troca automática da senha de teste. Isso não elimina o risco de usar uma senha fraca, portanto a conta deve ser tratada com cuidado.

## Limitações e próximos passos

- O projeto deve ser criado **uma vez na conta Google**, porque o Apps Script precisa do consentimento da titular.
- A rotina não é uma sincronização bidirecional. **Editar a planilha não altera automaticamente registros no Supabase**; esta versão escreve o resumo do Portal na aba gerenciada.
- As ações Apps Script do Google estão sujeitas às cotas atuais de tempo e chamadas de URL. Consulte [cotas oficiais](https://developers.google.com/apps-script/guides/services/quotas).
- A instalação remota e a execução agendada **não foram realizadas**: dependem da sua autorização Google e da chave gerada pela sua conta PRESCON.
- Para futuras extensões — Docs privados, Google Forms, alertas, geração de atas — implementar permissões e endpoints específicos, não reutilizar a chave de resumo para autorizar ações de escrita.

## Arquitetura

```
Portal PRESCON (login Supabase)
  └─ cria chave de sincronização (uma vez)
       └─ Banco Supabase: somente hash e metadados

Apps Script PRIVADO (conta Google da PRESCON)
  ├─ gatilho a cada seis horas
  ├─ lê chave das Propriedades do script
  ├─ GET prescon-workspace?action=apps_script_snapshot
  │     └─ servidor valida chave + perfil PRESCON, retorna apenas totais por EJ
  └─ Google Sheets: somente aba PRESCON_AUTOMACOES
```
