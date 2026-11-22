# Central PRESCON · NEJLON

Central independente para a Presidência do Conselho do NEJ Londrina.

**Objetivo:** funcionar mesmo que nenhum conselheiro adote o portal. A PRESCON gerencia prazos, demandas, justificativas, reuniões, encaminhamentos, deliberações e relatórios. O **Google Drive continua como arquivo institucional**.

## Estrutura
- `index.html`: Central de Automações exclusiva da PRESCON; pode ser explorada sem login.
- `pages/`: visual e funcionalidades independentes do portal original.
- `docs/`: integração e regras de segurança.

## Dados e permissões
Acesso administrativo restrito ao perfil PRESCON ativo no Supabase. A visualização pública é apenas uma prévia. Não inclua chaves `service_role` ou segredos do Google em arquivos do GitHub.

## Google Drive atual
A pasta **Drive do Conselho 13 🐿️❤️** e a planilha **Painel Conselho 2026** são referências institucionais existentes, que não são movidas ou sobrescritas automaticamente. Organização histórica observada: Transparências, Materiais de reuniões, PROCEL e Documentos.

## Publicação
GitHub → Settings → Pages → Deploy from a branch → `main` → `/(root)`.

A integração Google exige OAuth próprio no servidor, com consentimento da conta Google; conectar o Google Drive ao ChatGPT não conecta automaticamente o site. Enquanto isso, relatórios podem ser preparados/copied no painel e arquivos existentes podem ser abertos por links do Drive.

**Estado:** código do projeto separado do portal anterior; antes do uso institucional, validar a autenticação PRESCON, permissões de banco, geração de documentos e publicação do Pages.
