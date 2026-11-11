# Sistema de Presença — Grupo Se Toque

## Banco de dados e segurança

O modelo de escrita é relacional e normalizado: `public.participants`, `public.meetings` e `public.attendance`. O CPF é um atributo único do participante, enquanto a presença referencia um UUID estável, evitando remapeamentos quando o CPF muda.

A camada `analytics` expõe as dimensões `dim_date`, `dim_participant` e `dim_meeting`, mais a fato `fact_attendance`. São views de leitura sobre o modelo transacional — um star schema derivado, sem duplicar dados nem criar uma segunda fonte de verdade. As views usam `security_invoker` para respeitar as políticas RLS das tabelas de origem.

`private.app_user_roles` mantém os papéis fora do schema exposto pelo PostgREST. A função `public.is_active_admin()` permite acesso somente a usuários ativos com papel `admin`. As tabelas públicas e o bucket privado `participant-photos` exigem esse papel; o cliente público não recebe a chave `service_role`.

## CLI login

The Supabase CLI login only starts from a real interactive terminal, not Hermes' captured JSON-output shell. From the opened Windows Terminal tab `Supabase CLI Se Toque Login`, run:

```powershell
supabase login --name presenca-setoque
```

Complete the browser authorization there. Do not paste an access token into chat, a script, command history, Git, or the workflow. Then verify the new credentials without printing them:

```powershell
supabase projects list --output json
supabase link --project-ref <verified-ref>
supabase db push --dry-run
```

Only link the project named **Presença** in Sheila's organization after confirming the organization and exact project ref. Do not use the CRM projects. Do not apply migrations unless dry-run shows the expected initial schema against the intended database and the operator confirms the project is the target.


Não existe conta, senha ou usuário padrão nesta migration. Depois de criar/convidar um usuário no Supabase Auth e confirmar o UUID dele, o operador do projeto executa uma única vez no SQL Editor:

```sql
SELECT private.bootstrap_first_admin('<AUTH_USER_UUID>'::uuid, 'Lucas');
```

A função recusa novos bootstraps quando já existe qualquer papel registrado. A senha é definida pelo próprio usuário no fluxo de convite; não use `Lucas123` nem coloque credenciais no código, no Git ou no chat.

## Configuração do front-end

O modo Supabase deve receber somente a URL do projeto e a chave publicável (`VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`). A chave publicável pode aparecer no bundle apenas porque todas as tabelas e objetos são protegidos por RLS. Nunca coloque uma chave `secret`/`service_role`, PAT do Supabase ou senha do banco no front-end, no workflow de publicação ou no repositório.

O cadastro público de contas não faz parte da interface. Contas são criadas/invitadas pelo operador e só recebem acesso aos dados após serem marcadas como administradoras por um procedimento privilegiado.

## GitHub Pages deployment

Before source is pushed, in the private repo add GitHub Actions Variables (not secrets, since these public client values are compiled into the site): `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. They are not yet configured; workflow fails fast if either is absent. Keep all secret/service-role keys out of the client build.

The Pages workflow publishes only `dist/`, sets the repository base path, and waits for build/tests. After push, enable Pages with GitHub Actions as its source, then verify the Actions run and resulting public URL. Do not say a preview is online until both are confirmed.


A migration `migrations/20261110000100_initial_schema.sql` cria o schema inicial para um projeto Supabase novo e vazio. Ela ainda **não foi aplicada** a um projeto remoto. Antes de aplicar, confirme o nome, referência imutável, região e estado saudável do projeto; verifique que não existem objetos conflitantes; rode `supabase db push --dry-run`; depois aplique e leia de volta o histórico, grants, RLS, funções e bucket.

Nenhuma pessoa, presença, foto, planilha, backup ou outro dado do banco local é incluído nesta migration. A base local continua sendo a fonte atual; qualquer transferência futura exige autorização própria e uma etapa de migração validada.

## Situação desta preparação

- Migration inicial e testes de contrato estáticos foram preparados localmente.
- Região prevista para o novo projeto: São Paulo (`sa-east-1`), sujeita à disponibilidade no plano escolhido.
- Projeto remoto, usuário de teste e publicação no GitHub Pages ainda não foram criados.
- O usuário de teste “Lucas” depende de um e-mail informado pelo titular; nenhum e-mail/senha foi presumido.
