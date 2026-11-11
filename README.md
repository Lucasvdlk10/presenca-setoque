# Grupo Se Toque — Presença Local

Aplicação local-first para cadastro de participantes e lançamento de presença/falta. O frontend é React + Vite; a API local Python usa SQLite. O banco `presencas.sqlite3` fica nesta pasta, sem sincronização externa.

## Abrir

1. Requer Node.js/npm e Python 3 instalados.
2. Execute `Abrir Sistema.bat`.
3. O navegador abrirá `http://127.0.0.1:5173`. Mantenha as janelas de serviço abertas enquanto utiliza o painel.
4. Na primeira instalação ou após atualizar dependências, execute `npm install` nesta pasta.



## GitHub Pages preparation

- `npm ci` installs the lockfile; `npm run build` produces `dist/`.
- Configure `VITE_BASE_PATH=/REPOSITORY/` for Pages in a repository subpath; use `/` for a future subdomain.
- Publish only built `dist/`, never Python/SQLite backend files.
- After provisioning, put only the project URL and publishable key in GitHub Actions Variables. Never commit service-role keys, PATs, or `.env` files.
- `.gitignore` excludes SQLite, workbook, legacy JSON, build output, dependencies, and runtime secrets. Review ignored/staged files before push.
- Keep source private unless Lucas explicitly approves public visibility; Pages does not require public source.

- Interface alinhada ao site oficial do Grupo Se Toque: fundo creme rosado, vermelho coral (#C4313C), blush (#F0D5CE), tipografia Inter/system e cantos arredondados. Usa o logotipo SVG oficial no menu lateral e favicon; não reutiliza fotos institucionais no painel.
- Migra e usa a base local de presença existente; participantes com dados básicos preservados.
- Cadastro de pessoas com nome, CPF, telefone, e-mail, nascimento, observações e foto opcional.
- Fotos JPG/PNG/WebP redimensionadas no navegador e armazenadas localmente como BLOB no SQLite; miniatura na tabela e duplo clique para ampliar.
- Lançamentos nas segundas e quartas, com Presente, Falta, Falta Justificada e Feriado.
- Consulta por mês/ano e encontro; busca por nome/CPF.
- Exportação do intervalo definido para CSV, XLSX e PDF.
- Chave de unicidade do lançamento: data + CPF. CPF é armazenado como texto.

## Testes

Execute `python -m unittest discover -s tests -v` na pasta do projeto. A suíte usa bancos SQLite temporários e dados sintéticos; não grava no banco canônico.

## Estrutura

- `web/src/main.jsx`, `web/src/style.css`: interface React.
- `api.py`: API REST local.
- `presencas.sqlite3`: banco operacional local.
- `supabase/schema.sql`: modelo inicial para migração futura; ainda não conectado.
- `package-lock.json`: versões reproduzíveis do frontend.

## Migração futura para Supabase

O frontend concentra comunicação HTTP no constante `API` e na função `api()` em `web/src/main.jsx`; trocar esse adaptador por um repositório Supabase permite preservar os componentes. `supabase/schema.sql` descreve IDs UUID e relação `attendance.participant_id → participants.id`, diferente da chave de conveniência por CPF usada no SQLite local. Antes de ativar nuvem, criar autenticação, políticas RLS por organização/turma, revisar consentimento e restringir acesso a CPF.

## Acesso, privacidade e cópia de segurança

- No primeiro acesso, crie o perfil administrador local, escolha um usuário de 3–32 caracteres (letras, números, ponto, hífen ou sublinhado) e uma senha/frase com pelo menos 15 caracteres. Não há usuário ou senha padrão.
- Nas próximas aberturas, entre com esse usuário e senha. O botão circular de iniciais no canto superior direito abre as opções para editar o perfil, configurar/alterar a senha e sair da sessão.
- A sessão expira após 12 horas. Alterar a senha encerra as demais sessões e mantém ativa a sessão atual com um token renovado.
- A API escuta somente em `127.0.0.1` e exige sessão para ler ou alterar participantes, presenças e fotos. Senhas não são armazenadas em texto puro; não envie credenciais por chat.
- O login protege o acesso pela interface e API, mas não criptografa o arquivo SQLite em repouso. Quem tiver acesso à mesma conta do Windows e ao sistema de arquivos ainda poderá acessar o banco; proteja a conta Windows e as cópias de segurança.
- Não há recuperação de senha por e-mail ou nuvem; em caso de esquecimento, será necessário um procedimento local de recuperação.
- Mantenha o banco e a planilha original somente na pasta canônica deste sistema. Faça backups consistentes do SQLite e não os copie para pastas de revisão ou preview. Não exponha a API na rede nem publique/deploy sem autorização separada.
