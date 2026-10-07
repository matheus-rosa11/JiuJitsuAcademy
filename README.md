# Tatame — Gestão de Academia de Jiu-Jitsu (POC)

POC para validar com donos e professores de academia: alunos (adulto/infantil), responsáveis, faixas e graus,
histórico de graduações, turmas, presença, mensalidades e dashboard.

> "Tatame" é um nome provisório, definido em `front/src/components/AppShell.tsx`.

## Stack

| Parte    | Tecnologia                                                        |
| -------- | ----------------------------------------------------------------- |
| Backend  | ASP.NET Core 10 Web API, EF Core 10 (migrations), PostgreSQL       |
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind CSS 4               |
| Deploy   | Railway (3 serviços: Postgres, `api`, `front`), Dockerfile por serviço |

## Estrutura

```text
api/                     ASP.NET Core (um único projeto)
  Controllers/           Endpoints REST finos (sem regra de negócio)
  Services/              Regras de negócio (BeltRules, StudentService, GraduationService...)
  Models/                Entidades EF Core
  Data/                  AppDbContext + DbSeeder (faixas + dados de demonstração)
  DTOs/                  Contratos da API (records)
  Migrations/            Migrations do EF Core
front/                   Next.js
  src/app/               Páginas (Dashboard, Alunos, Turmas, Presença, Graduações, Financeiro)
  src/app/api/[...path]  Proxy para a API (o navegador nunca fala direto com a API)
  src/components/        Componentes reutilizáveis (ui.tsx, BeltBadge, StudentForm...)
  src/lib/               Tipos da API, hook useApi, formatação
docker-compose.yml       PostgreSQL local
```

### Decisões principais

- **Regra de faixas em um único lugar:** `api/Services/BeltRules.cs` define as faixas adultas e infantis, o grau máximo
  e a validação de compatibilidade. O frontend só pede `GET /api/belts?studentType=Adult|Child` e mostra o que vier.
- **Histórico de graduação imutável:** toda troca de faixa/grau cria um registro em `Graduations`. A faixa atual do
  aluno é a graduação mais recente (por data), então registrar uma graduação retroativa não sobrescreve a atual.
- **Responsáveis compartilhados:** `Responsible` ↔ `StudentResponsible` ↔ `Student` (N:N), com `IsPrimary` e
  `Relationship` no vínculo. Irmãos apontam para o mesmo responsável.
- **Presença sem duplicidade:** índice único em `(StudentId, ClassId, Date)`; salvar a chamada de novo atualiza.
- **Mensalidade em atraso:** pendentes com vencimento passado viram `Overdue` automaticamente na leitura.
- **Erros:** serviços lançam `DomainException` (400) / `NotFoundException` (404); um handler central em `Program.cs`
  devolve `{ "message": "..." }`, que o frontend mostra em toasts.
- **Login com Google (futuro):** o pipeline já tem `AddAuthorization()`/`UseAuthorization()`; basta adicionar
  autenticação e `[Authorize]` nos controllers. No frontend, o proxy `src/app/api/[...path]/route.ts` é o ponto
  único para anexar o token da sessão.

## Desenvolvimento local

Pré-requisitos: .NET SDK 10, Node 22+, Docker.

```bash
# 1. Banco (Postgres na porta 5433 para não conflitar com outro Postgres local)
docker compose up -d

# 2. API — aplica migrations e popula dados de demonstração na inicialização
cd api
dotnet run --launch-profile http        # http://localhost:5106 (health: /health)

# 3. Frontend (outro terminal)
cd front
npm install
npm run dev                             # http://localhost:3000
```

O frontend usa `API_URL=http://localhost:5106` por padrão (veja `front/.env.example`).

Criar uma nova migration (a partir de `api/`):

```bash
dotnet tool restore
dotnet ef migrations add NomeDaMigration -- --environment Development
```

Resetar o banco para os dados de demonstração:

```bash
docker compose down -v && docker compose up -d
# depois reinicie a API
```

## Deploy na Railway

Um único repositório git com dois serviços de aplicação, separados por pasta: `/api` e `/front`. Cada pasta tem
seu `Dockerfile` e `railway.json` (builder Dockerfile, healthcheck, restart policy e watch patterns para só
redeployar o serviço cuja pasta mudou). Os três serviços ficam no **mesmo projeto e ambiente** da Railway.

1. **Banco:** serviço PostgreSQL da Railway (**New → Database → PostgreSQL**). Ele já expõe `DATABASE_URL`
   apontando para `${{RAILWAY_PRIVATE_DOMAIN}}:5432` (rede privada, sem custo de egress).
2. **Serviço `api`:** New → GitHub Repo → este repositório.
   - Settings → **Service Name**: `api` (o nome é usado na referência do front).
   - Settings → **Root Directory**: `/api`
   - Settings → **Railway Config File**: `/api/railway.json` (caminho absoluto; a Railway não aplica o Root
     Directory a esse arquivo).
   - Variables:

     | Variável                 | Valor                         |
     | ------------------------ | ----------------------------- |
     | `DATABASE_URL`           | `${{Postgres.DATABASE_URL}}`  |
     | `PORT`                   | `8080`                        |
     | `SEED_DEMO_DATA`         | `true` (use `false` em produção real) |

     `DATABASE_URL` é uma **referência** ao serviço do banco (Variables → New Variable → Add Reference →
     Postgres → `DATABASE_URL`), não uma cópia da senha. `Postgres` é o nome do serviço do banco no canvas; se
     você o renomeou, use o nome atual. A API converte esse formato `postgresql://...` para a connection string
     do Npgsql e aplica as migrations ao subir.
   - Não precisa de domínio público: o front acessa a API pela rede privada.
3. **Serviço `front`:** New → GitHub Repo → mesmo repositório.
   - Settings → **Service Name**: `front`
   - Settings → **Root Directory**: `/front`
   - Settings → **Railway Config File**: `/front/railway.json`
   - Variables:

     | Variável  | Valor                                                  |
     | --------- | ------------------------------------------------------ |
     | `API_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |

   - Settings → Networking → **Generate Domain** (porta `3000`).
4. Deploy. A API cria as tabelas, as faixas e os dados de demonstração e responde em `/health`; o front responde
   em `/`. Se `DATABASE_URL` não estiver configurada, a API falha no start com a mensagem
   "Configure DATABASE_URL or ConnectionStrings:DefaultConnection." (visível em Deploy Logs).

### Variáveis de ambiente

| Serviço | Variável         | Obrigatória | Descrição |
| ------- | ---------------- | ----------- | --------- |
| api     | `DATABASE_URL`   | sim         | URL `postgresql://user:pass@host:port/db` (formato da Railway). Localmente usa `ConnectionStrings:DefaultConnection` de `appsettings.Development.json`. |
| api     | `PORT`           | sim (Railway) | Porta HTTP. Definir explicitamente permite usar `${{api.PORT}}` no front. A API escuta em IPv4 e IPv6 (exigido pela rede privada). |
| api     | `SEED_DEMO_DATA` | não         | `false` desativa os dados fictícios. As faixas são sempre criadas. Os dados de demo só entram se não houver alunos. |
| api     | `CORS_ORIGINS`   | não         | Lista separada por vírgula. Só necessária se algum cliente chamar a API direto do navegador (o front usa proxy no servidor). |
| front   | `API_URL`        | sim         | URL base da API, lida em runtime (a mesma imagem serve qualquer ambiente). |
| front   | `PORT`           | automática  | Injetada pela Railway; o servidor standalone do Next a respeita. |

## Roteiro de demonstração

Com os dados de demonstração (27 alunos, irmãos com responsáveis compartilhados, 60 dias de presença, 4 meses de
mensalidades pagas, pendentes e em atraso):

1. **Dashboard** — alunos ativos, receita prevista/recebida/pendente/em atraso, frequência média, alunos com baixa
   frequência, distribuição por faixas adultas e infantis, graduações recentes.
2. **Alunos** — busca por nome; filtros por tipo, situação e faixa.
3. **Novo aluno → Adulto** — só aparecem Branca, Azul, Roxa, Marrom e Preta.
4. **Novo aluno → Infantil** — só aparecem as 13 faixas infantis; seção de responsáveis permite vincular um
   responsável já cadastrado (ex.: "Maria Silva", mãe da Ana e do Pedro) e/ou criar um novo, marcando o principal.
5. **João Silva** (aluno adulto) — timeline com o histórico Branca → 1º, 2º, 3º grau → Azul.
   **Registrar graduação** sugere o próximo passo e mostra se é troca de faixa ou de grau; o histórico anterior é mantido.
6. **Turmas** — "Fazer chamada de hoje" abre a chamada da turma.
7. **Presença** — toque no aluno para marcar, "Todos presentes", salvar. Aba **Frequência**: 30/60/90 dias, por turma,
   filtro "abaixo de 60%".
8. **Financeiro** — navegação por mês, "Gerar mensalidades do mês", "Recebido" em um clique, filtro de atrasados
   (todos os meses).
9. Volte ao **Dashboard** para ver os indicadores atualizados.

## API (resumo)

| Método | Rota | Descrição |
| ------ | ---- | --------- |
| GET | `/api/dashboard` | Indicadores gerais |
| GET | `/api/belts?studentType=` | Faixas (filtradas por tipo de aluno) |
| GET/POST | `/api/students` | Lista (`search`, `type`, `active`, `beltId`) / cria |
| GET/PUT/DELETE | `/api/students/{id}` | Detalhe / atualiza / desativa |
| GET/POST | `/api/students/{id}/graduations` | Histórico / registra graduação |
| GET | `/api/graduations/recent` | Últimas graduações |
| GET/POST/PUT | `/api/responsibles` | Responsáveis |
| GET/POST/PUT | `/api/classes` | Turmas |
| GET | `/api/attendance/sheet?classId=&date=` | Lista de chamada |
| POST | `/api/attendance` | Salva chamada (upsert) |
| GET | `/api/attendance/frequency?days=&classId=` | Frequência por aluno |
| GET/POST/PUT/DELETE | `/api/payments` | Mensalidades (`status`, `search`, `year`, `month`) |
| GET | `/api/payments/summary?year=&month=` | Resumo financeiro do mês |
| POST | `/api/payments/{id}/mark-paid` | Marca como pago |
| POST | `/api/payments/generate` | Gera mensalidades do mês para alunos ativos |
| GET | `/health` | Healthcheck |

Fora do escopo desta POC: pagamento online, PIX, boleto, notas fiscais, WhatsApp, notificações, app mobile e login.
