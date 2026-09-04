# ScreenShare Rooms

Notas pessoais do MVP de compartilhamento de tela em tempo real.

Salas anônimas, sem cadastro. Cada sala tem um código, compartilhamento de
tela pelo navegador e chat via LiveKit.

## Stack

- Next.js + React + TypeScript
- Tailwind CSS
- LiveKit / WebRTC
- PostgreSQL + Prisma
- Docker Compose

## Rodar localmente

Pré-requisitos: Node.js 20+ e Docker.

```bash
npm install
neon env pull
docker compose up -d livekit
npm run db:deploy
npm run dev
```

Abrir: <http://localhost:3000>

O comando `neon env pull` preenche o `.env` com as variáveis do branch Neon
vinculado. O arquivo `.env` é local e não deve ser commitado. As credenciais de
`livekit.yaml` são somente para desenvolvimento local.

## Comandos úteis

```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm run start      # inicia o build
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # testes
npm run check      # lint + tipos + testes + build

npm run db:deploy  # aplica migrations existentes
npm run db:studio  # abre o Prisma Studio
npm run db:push    # sincroniza o schema sem criar migration
```

## Variáveis principais

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Conexão pooled do PostgreSQL |
| `DATABASE_URL_UNPOOLED` | Conexão direta usada pelo Prisma |
| `LIVEKIT_URL` | URL do servidor LiveKit |
| `LIVEKIT_API_KEY` | Chave do LiveKit |
| `LIVEKIT_API_SECRET` | Segredo do LiveKit |
| `ROOM_INACTIVITY_TTL_SEC` | Tempo de expiração da sala |
| `CRON_SECRET` | Protege a limpeza automática em produção |
| `DEV_ALLOWED_ORIGINS` | Permite acesso ao dev server pela rede local |

## Estrutura rápida

```text
src/app/          páginas e rotas da API
src/components/   interface e componentes LiveKit
src/hooks/        hooks de chat e métricas
src/lib/          LiveKit, Prisma, limpeza e utilitários
src/types/        tipos compartilhados
prisma/           schema e migrations
tests/            testes automatizados
```

## Lembretes

- Compartilhamento de tela exige HTTPS ou `localhost`.
- `1080p60` é o alvo padrão para movimento e pode usar até aproximadamente
  10 Mbps no stream único; `720p60` continua disponível para hardware mais lento.
- A captura fica limitada ao perfil escolhido, mas não é reduzida novamente por
  uma segunda rotina da aplicação. Em `1080p60`, o WebRTC preserva a resolução e
  reduz quadros primeiro quando não há bitrate suficiente.
- A taxa solicitada é um alvo: a origem selecionada, o compositor do sistema,
  o encoder, a rede e o decoder podem entregar menos de 10 Mbps ou 60 fps.
- Use **Sender diagnostics** no menu de qualidade para abrir as métricas de
  captura, encode, bitrate e rede em um modal.
- A sala é anônima; o código funciona como acesso à sala.
- O chat só habilita quando existe outro participante.
- Salas inativas são removidas automaticamente.
- Em produção, usar `wss://`, credenciais reais e TURN.
- Nunca adicionar `.env` ou segredos reais ao Git.

## Produção para 60 fps

O arquivo `livekit.yaml` continua sendo apenas para desenvolvimento local. Use
`livekit.prod.example.yaml` como base e injete chaves/certificados pelo gerenciador
de segredos. Para evitar perda de qualidade por transporte:

- coloque o SFU perto dos usuários e prefira conexão direta por UDP;
- libere UDP `50000-60000`, TCP `7881`, TURN/UDP `443` e TURN/TLS `443` em um
  endpoint L4 dedicado;
- em Linux/Docker, use host networking e ajuste os buffers UDP conforme os
  avisos do LiveKit;
- reserve pelo menos 12 Mbps estáveis de upload e download por compartilhamento
  ativo para validar 1080p60 com folga;
- monitore a porta Prometheus `6789` somente pela rede privada;
- execute testes de carga antes de aumentar o número de espectadores. Uma sala
  LiveKit precisa caber em um único nó.

Critério de laboratório: após 10 segundos de aquecimento, captura, encode,
decode e apresentação devem permanecer em pelo menos 55 fps em 95% das amostras
de um segundo, com perda de pacotes abaixo de 1% e sem congelamentos maiores que
250 ms.

## Estado atual

MVP funcional. Ainda não há login, moderação de apresentadores, gravação ou
salas persistentes.

Licença: MIT.
