# ScreenShare Rooms

Plataforma de compartilhamento de tela em tempo real.
Salas anônimas, sem cadastro — crie uma sala, compartilhe a tela e assista
junto com sua equipe ou amigos, direto do navegador.

## Stack

- **Next.js 15** (App Router) + React 19 + TypeScript
- **Tailwind CSS** (dark mode por padrão)
- **LiveKit** para WebRTC / compartilhamento de tela e data channel
- **PostgreSQL + Prisma** para persistência
- **Docker Compose** para a infraestrutura de dev

## Pré-requisitos

- Node.js 18+ (recomendado 20+)
- Docker + Docker Compose

## Setup

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de ambiente local
cp .env.example .env

# 3. Suba a infraestrutura (Postgres e LiveKit)
docker compose up -d

# 4. Aplique as migrations já versionadas
npm run db:deploy

# 5. Rode o app
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Como usar

1. Na home, clique em **Criar sala** ou entre com um código.
2. Informe um nickname (anônimo, salvo apenas no seu navegador).
3. Na sala, clique em **Compartilhar tela** — o navegador pedirá permissão
   (`getDisplayMedia`). Sua tela aparece como elemento principal para todos.
4. Use o **Chat** e a aba **Participantes** na barra lateral.

O chat é habilitado quando pelo menos duas pessoas estão conectadas à sala;
enquanto você estiver sozinho, o campo permanece desativado.

Antes de compartilhar, escolha um perfil de qualidade: **Auto** tenta
1080p60 e reduz para 1080p30/720p15 quando o navegador não suporta a captura;
**Balanced** usa 1080p30; **Data saver** usa 720p15. O LiveKit publica camadas
simulcast e seleciona uma qualidade adequada para cada espectador.
Se o navegador ficar limitado pela CPU por várias amostras, o perfil Auto ativa
um modo de desempenho para manter o envio estável.

Quando uma tela está sendo compartilhada, use **Fullscreen** no canto superior
direito do vídeo para expandir a visualização.

Se a fonte escolhida oferecer áudio, o botão **Mute audio** aparece ao lado do
controle de compartilhamento para silenciar ou reativar o áudio enviado aos
outros participantes.

O menu **Quality** também tem a opção **Show live FPS**. Ative-a durante o
compartilhamento para ver a resolução e a taxa de quadros capturadas e enviadas;
quando o navegador ainda não disponibilizou as métricas, a interface mostra
“waiting for stats…” em vez de valores inválidos.

Salas são temporárias: o LiveKit remove salas vazias após 5 min
(`empty_timeout`) e o banco limpa registros com mais de 1h de inatividade.

## Estrutura

```
src/
├── app/                 # páginas (App Router) + API routes
│   ├── page.tsx         # home (criar / entrar)
│   ├── room/[code]/     # sala
│   └── api/             # rooms, token, cleanup
├── components/          # UI kit + componentes LiveKit
├── hooks/               # useChat (data channel)
├── lib/                 # prisma, livekit, cleanup, utils
└── types/               # tipos compartilhados
```

## Arquitetura

- **Postgres** — fonte da verdade persistente (registro da sala, atividade).
- **LiveKit server** — estado realtime: participantes, tracks de tela e
  data channel do chat (sem pub/sub adicional).
- **Limpeza por inatividade** — clientes conectados renovam a atividade a cada
  minuto, e a limpeza também consulta o LiveKit antes de remover uma sala. A
  rota `GET /api/cleanup` é chamada diariamente pelo Vercel Cron; `POST`
  permanece disponível para execução manual autenticada.

## Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL pooled do Postgres usada pela aplicação |
| `DIRECT_URL` | URL direta do Postgres usada pelas migrations |
| `LIVEKIT_URL` | URL de signaling (`ws://localhost:7880`) |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Dev keys (espelham `livekit.yaml`) |
| `DEV_ALLOWED_ORIGINS` | Hostnames/IPs separados por vírgula permitidos no dev via LAN |
| `ROOM_INACTIVITY_TTL_SEC` | TTL de limpeza (default 3600) |
| `CRON_SECRET` | Segredo enviado pelo Vercel Cron no header `Authorization` (obrigatório em produção) |

> ⚠️ As credenciais em `livekit.yaml` e `.env` são de **desenvolvimento**.
> Troque por segredos reais e use TURN em produção.

## Scripts

| Comando | Ação |
|---|---|
| `npm run dev` | Servidor de dev |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run lint` | Validação ESLint |
| `npm run typecheck` | Validação TypeScript |
| `npm test` | Testes automatizados |
| `npm run check` | Lint, tipos, testes e build de produção |
| `npm run db:deploy` | Aplicar migrations existentes em produção |
| `npx prisma studio` | Inspecionar o banco |
| `npx prisma migrate dev` | Criar/aplicar migrations |

## Deploy gratuito (demo pessoal)

A configuração recomendada usa serviços gerenciados na região de São Paulo:

- **Vercel Hobby** — aplicação Next.js e API routes;
- **Neon Free** — Postgres;
- **LiveKit Cloud Build** — signaling, mídia WebRTC, TURN e data channel.

O arquivo `vercel.json` fixa as Functions em `gru1` (São Paulo) e executa a
limpeza diariamente às 06:00 UTC. Arquivos estáticos continuam distribuídos
globalmente pela CDN da Vercel.

### 1. Banco Neon

1. Crie um projeto Neon na região AWS São Paulo (`sa-east-1`).
2. Copie a conexão **pooled** para `DATABASE_URL`.
3. Copie a conexão **direct** para `DIRECT_URL`.
4. Com essas variáveis carregadas localmente, execute `npm run db:deploy` uma
   vez antes do primeiro deploy e novamente sempre que houver novas migrations.

### 2. LiveKit Cloud

1. Crie um projeto no plano Build e selecione a região South America/Brazil.
2. Copie o endpoint `wss://...livekit.cloud`, a API key e o API secret.
3. Não reutilize as credenciais de desenvolvimento do `livekit.yaml`.

### 3. Vercel

1. Envie o projeto para um repositório GitHub e importe-o na Vercel.
2. Cadastre as variáveis abaixo no ambiente **Production**:

   ```text
   DATABASE_URL=<Neon pooled URL>
   DIRECT_URL=<Neon direct URL>
   LIVEKIT_URL=wss://<seu-projeto>.livekit.cloud
   LIVEKIT_API_KEY=<LiveKit Cloud API key>
   LIVEKIT_API_SECRET=<LiveKit Cloud API secret>
   ROOM_INACTIVITY_TTL_SEC=3600
   CRON_SECRET=<segredo aleatório com pelo menos 16 caracteres>
   ```

3. Faça o deploy e teste pelo domínio HTTPS `*.vercel.app` em dois navegadores
   ou dispositivos diferentes.

Todos os segredos são usados apenas nas API routes. Nunca adicione o prefixo
`NEXT_PUBLIC_` a eles nem envie arquivos `.env` ao Git.

### Limites do plano gratuito

Esta configuração é voltada a demonstrações pessoais, sem SLA. Monitore os
dashboards dos três provedores. Compartilhamento em 1080p60 consome bastante
banda, então a franquia de transferência do LiveKit tende a ser o primeiro
limite atingido. Quando o projeto crescer, o LiveKit é o primeiro serviço a
reavaliar.

## Notas e limitações (MVP)

- A configuração local usa `ws://localhost:7880`. Para produção, use o endpoint
  `wss://` do LiveKit Cloud; compartilhamento de tela exige HTTPS ou localhost.
- Não há login nem autenticação de usuário; o "segredo" de uma sala é o código
  compartilhável.
- A interface exibe compartilhamentos simultâneos em grade, mas ainda não
  oferece seleção ou moderação de apresentadores.
- A arquitetura está preparada para futuras features como autenticação,
  gravação e salas persistentes.

## Licença

MIT.
