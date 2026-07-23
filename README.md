# InLabs.Ai Studios

Plataforma para criação de carrosséis e cartazes para Instagram com geração de textos e imagens pela API do Google Gemini.

## Fluxo de acesso

- Não existe cadastro público.
- Usuários entram somente com uma chave no formato `INL-XXXX-XXXX-XXXX`.
- Somente o administrador pode criar, bloquear, reativar ou excluir chaves.
- A rota administrativa é `/admin` e não aparece no menu dos usuários.
- Não existe página de vendas ou planos dentro do aplicativo.

## Tecnologias

- TanStack Start
- React + TypeScript
- Tailwind CSS
- Supabase
- Google Gemini API
- Fabric.js

## Configuração

1. Copie `.env.example` para `.env`.
2. Preencha as variáveis do Supabase.
3. Adicione a chave da Gemini apenas no servidor.
4. Defina uma senha administrativa forte e um segredo de sessão diferente da senha.

```bash
cp .env.example .env
npm install
npm run dev
```

## Variáveis obrigatórias

```env
SUPABASE_PROJECT_ID=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-3.5-flash
GEMINI_IMAGE_MODEL=gemini-3.1-flash-image

ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

## Segurança

- Nunca publique `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `ADMIN_PASSWORD` ou `ADMIN_SESSION_SECRET`.
- As chamadas de IA são executadas no servidor.
- A senha administrativa não é armazenada no navegador; o painel usa um token de sessão assinado e temporário.
- O arquivo `.env` não deve ser enviado ao GitHub ou ao Lovable.

## Banco de dados

As migrações existentes criam as tabelas de gerações e chaves de acesso. Execute as migrações do diretório `supabase` antes de usar o sistema em produção.

## Rotas principais

- `/acesso` — entrada por chave
- `/` — dashboard
- `/carrossel` — criação de carrossel
- `/cartaz` — criação de cartaz
- `/projetos` — projetos salvos
- `/biblioteca` — imagens e fontes
- `/configuracoes` — preferências e sessão
- `/editor/:id` — editor visual
- `/admin` — painel exclusivo do administrador
