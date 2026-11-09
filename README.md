# Chatbot WhatsApp — projeto individual para aula

Projeto didático com **WAHA + Node.js + Express + JavaScript + Docker Compose**. Cada aluno ou grupo executa sua própria cópia do projeto, conecta seu próprio número de WhatsApp à sua instância local da WAHA e desenvolve/testa o chatbot sem instalar Python ou Node.js no computador.

> **Importante sobre a sessão já conectada pelo professor:** este pacote é uma instalação independente para os computadores dos alunos. Ele não altera nem importa a sessão que já está conectada no computador do professor. A sessão do professor permanece no volume Docker existente dele. Cada aluno cria e autentica uma sessão própria chamada `default` na sua própria instalação.

## 1. Arquitetura

```text
WhatsApp do aluno
       |
       | mensagem recebida
       v
WAHA (container Docker do aluno)
       |
       | POST http://chatbot:3001/webhook
       v
Node.js + Express (container Docker do aluno)
       |
       +--> nlp.js       classifica intenção
       +--> chatbot.js   monta resposta
       +--> data.js      consulta catálogo/pedidos simulados
       |
       | POST /api/sendText
       v
WAHA --> WhatsApp do aluno
```

Cada instalação tem seus próprios containers, chave de API, volume de sessão e autenticação QR. O endereço `http://chatbot:3001/webhook` funciona dentro da rede Docker Compose; não é necessário ngrok para essa arquitetura local.

## 2. Requisitos

- Docker Desktop instalado e iniciado (Windows, macOS ou Linux) com Docker Compose disponível.
- Internet para baixar as imagens.
- WhatsApp em um celular para ler o QR Code.
- Não é necessário instalar Python, Node.js, npm ou bibliotecas no host.

Se o laboratório não permitir instalar Docker Desktop, o professor/administrador precisa preparar essa instalação antes da aula.

## 3. Preparar o projeto

1. Extraia a pasta `chatbot-waha-aula`.
2. Abra um terminal dentro dessa pasta — é a pasta que contém `docker-compose.yml`.
3. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

No PowerShell do Windows, use:

```powershell
Copy-Item .env.example .env
```

4. Gere uma chave aleatória. macOS/Linux:

```bash
openssl rand -hex 24
```

No PowerShell, uma alternativa é:

```powershell
-join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

5. Edite `.env` e substitua `COLOQUE_AQUI_UMA_CHAVE_ALEATORIA` pela chave gerada.

### Escolha da imagem WAHA por arquitetura

No `.env`, ajuste `WAHA_IMAGE`:

- Mac com Apple Silicon (M1/M2/M3/M4): `devlikeapro/waha:arm`
- Windows/Linux x86_64: `devlikeapro/waha:latest`

A imagem `arm` é para processadores ARM. Não selecione essa imagem em computadores Intel/AMD x86_64. Consulte a documentação oficial para outras arquiteturas/tags.

## 4. Subir o ambiente

Na pasta do projeto:

```bash
docker compose up -d --build
```

Verifique os containers:

```bash
docker compose ps
```

Acompanhe os logs:

```bash
docker compose logs -f waha
```

Em outra janela, se necessário:

```bash
docker compose logs -f chatbot
```

## 5. Conectar o WhatsApp do aluno

1. Abra `http://localhost:3000/dashboard`.
2. Conecte o Dashboard à API usando a chave definida em `WAHA_API_KEY` no `.env`, caso seja solicitada.
3. Na área **Sessions**, crie uma sessão chamada exatamente `default`.
4. Inicie a sessão e aguarde o estado `SCAN_QR_CODE`.
5. Exiba o QR Code e leia pelo WhatsApp do celular: **Dispositivos conectados → Conectar dispositivo**.
6. Aguarde o estado `WORKING`.

O Compose define o webhook global da WAHA para `http://chatbot:3001/webhook`, ouvindo o evento `message`. Assim, a sessão `default` envia eventos ao servidor JavaScript automaticamente. Não configure um segundo webhook igual na sessão, para não duplicar eventos.

> A sessão já conectada no computador do professor tem outro nome e está em outro volume. Não tente usar esse nome no projeto do aluno: cada instalação local cria sua própria sessão `default`.

## 6. Abrir o simulador e testar sem WhatsApp

- Simulador web: http://localhost:3001
- Saúde do chatbot: http://localhost:3001/health
- Produtos: http://localhost:3001/api/produtos
- Pedido de exemplo: http://localhost:3001/api/pedidos/1002
- Dashboard WAHA: http://localhost:3000/dashboard

Teste a classificação sem enviar mensagem real:

```bash
curl -X POST http://localhost:3001/simular \
  -H 'Content-Type: application/json' \
  -d '{"texto":"Qual o preço do teclado?"}'
```

No PowerShell, pode usar:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/simular -ContentType 'application/json' -Body '{"texto":"Qual o preço do teclado?"}'
```

## 7. Testar o webhook localmente

Para testar o processamento sem depender do WhatsApp, altere `SEND_ENABLED=false` no `.env` e recrie o serviço do chatbot:

```bash
docker compose up -d --build chatbot
```

Envie um evento de teste:

```bash
curl -X POST http://localhost:3001/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"message","payload":{"id":"teste-1","from":"5567999999999@c.us","fromMe":false,"body":"preço do teclado"}}'
```

Com `SEND_ENABLED=false`, o webhook classifica a mensagem e registra o resultado, mas não envia nada ao WhatsApp. Para voltar ao envio real, altere para `SEND_ENABLED=true` e execute `docker compose up -d`.

## 8. Testar mensagens reais

Com a sessão em `WORKING` e `SEND_ENABLED=true`:

1. Envie uma mensagem de outro número para o WhatsApp conectado à WAHA.
2. Veja o log do chatbot:

```bash
docker compose logs -f chatbot
```

3. O servidor recebe o evento, identifica a intenção e chama `POST /api/sendText` da WAHA.
4. A resposta retorna ao WhatsApp que enviou a mensagem.

Mensagens de grupos são ignoradas no exemplo. Mensagens enviadas pelo próprio bot também são ignoradas para evitar loop.

## 9. Estrutura do projeto

```text
chatbot-waha-aula/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── chatbot/
    ├── Dockerfile
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── server.js
        ├── nlp.js
        ├── chatbot.js
        └── data.js
```

- `server.js`: Express, endpoints de teste, webhook e integração com WAHA.
- `nlp.js`: classificação didática por palavras-chave e pontuação.
- `chatbot.js`: regras para construir respostas.
- `data.js`: catálogo e pedidos fictícios.
- `public/index.html`: simulador no navegador.

## 10. Atividades sugeridas

1. Adicionar a intenção `horario` e responder com horário de atendimento.
2. Adicionar um produto ao catálogo e consultar preço/estoque.
3. Criar uma intenção `frete` e simular o cálculo.
4. Adicionar sinônimos e testar mensagens ambíguas.
5. Comparar a classificação por palavras-chave com TF-IDF ou outro método de NLP.
6. Integrar uma API pública ou simulada para consultar dados externos.

## 11. Portas, isolamento e problemas comuns

As portas estão vinculadas a `127.0.0.1`, portanto os serviços ficam acessíveis apenas no próprio computador. Se as portas 3000 ou 3001 já estiverem ocupadas, altere `WAHA_PORT` e/ou `CHATBOT_PORT` no `.env`.

Se o aluno receber `no configuration file provided`, ele executou o comando fora da pasta do `docker-compose.yml`.

Se receber `401 Unauthorized`, confira se o header `X-Api-Key` enviado pelo chatbot é igual ao `WHATSAPP_API_KEY` que o Compose passou à WAHA. Consulte a variável efetiva sem publicar a chave:

```bash
docker compose exec waha printenv WHATSAPP_API_KEY
```

Se a sessão ficar em `STARTING`, examine `docker compose logs --tail=200 waha`; confira arquitetura da imagem e erros do Chromium/Puppeteer. Se ficar em `SCAN_QR_CODE`, conclua a leitura do QR. O chatbot só responde quando a sessão estiver `WORKING`.

Se o aluno já tiver outro projeto usando os nomes fixos de containers, altere `COMPOSE_PROJECT_NAME` no `.env` ou remova `container_name` do Compose. Para evitar conflito de portas, ajuste também `WAHA_PORT` e `CHATBOT_PORT`.

## 12. Encerrar e preservar a sessão

Parar os containers sem apagar a sessão:

```bash
docker compose down
```

Para iniciar novamente:

```bash
docker compose up -d
```

**Não use `docker compose down -v`** se quiser preservar a autenticação e os dados do volume `waha_sessions`.

## Segurança e uso responsável

- Cada aluno deve manter sua API Key privada e não publicar o `.env`.
- Não exponha a porta da WAHA à rede pública. O Compose usa `127.0.0.1` de propósito.
- O webhook do exemplo é didático e não valida assinatura/segredo de origem; não use esta configuração diretamente em produção.
- Utilize apenas números e conversas com autorização. Evite disparos em massa.
- A WAHA automatiza o WhatsApp Web por meio de um mecanismo não oficial da API do WhatsApp. Isso pode envolver risco de bloqueio/restrição da conta e alterações de compatibilidade. Para a aula, prefira números de teste/dedicados, com consentimento, e verifique os termos aplicáveis antes de usar contas pessoais.
- O classificador é baseado em regras e palavras-chave; não é um modelo treinado de aprendizado de máquina.

## Documentação oficial

- WAHA Quick Start: https://waha.devlike.pro/docs/overview/quick-start/
- WAHA Engines e imagens Docker: https://waha.devlike.pro/docs/how-to/engines/
- WAHA Events e Webhooks: https://waha.devlike.pro/docs/how-to/events/
- WAHA Sessions: https://waha.devlike.pro/docs/how-to/sessions/

## 8. Treinamento de NLP com o dataset da aula

O exemplo foi ampliado para utilizar o arquivo `chatbot/datasets/dados_treinamento.csv`, derivado do material da aula. Ele contém 120 mensagens rotuladas, distribuídas igualmente entre quatro intenções: `saudacao`, `preco`, `estoque` e `pedido` (30 exemplos por intenção).

Ao iniciar, o servidor JavaScript:

1. lê o CSV;
2. normaliza as mensagens e gera características com TF-IDF (unigramas e bigramas);
3. separa os dados de forma estratificada em treinamento e teste (75%/25%);
4. treina uma Regressão Logística multiclasse implementada em JavaScript;
5. imprime a acurácia da avaliação nos logs;
6. treina novamente com todos os exemplos para classificar as mensagens recebidas pelo WhatsApp.

O classificador retorna a intenção, a confiança e as probabilidades por classe. Quando a confiança é baixa, o chatbot trata a mensagem como `desconhecida` e pede que o usuário reformule. A resposta final ainda utiliza as regras de negócio em `chatbot.js` para consultar os produtos e pedidos simulados em `data.js`.

### Testar o classificador sem WhatsApp

Com os containers ativos, envie uma mensagem para o endpoint de simulação:

```bash
curl -X POST http://localhost:3001/simular \
  -H 'Content-Type: application/json' \
  -d '{"texto":"Quanto custa o teclado?"}'
```

Experimente também:

- `Oi, tudo bem?`
- `Quero saber o valor do notebook`
- `Vocês ainda têm mouse disponível?`
- `Onde está meu pedido 1002?`
- `Quero falar com um atendente sobre a garantia`

A última mensagem pode ser classificada como desconhecida porque a base atual não possui uma intenção de garantia/atendimento. Isso é intencional: o modelo não deve inventar uma classe que não foi ensinada.

### Atividade de treinamento para os alunos

1. Acrescente pelo menos cinco novas frases para cada intenção no CSV.
2. Reinicie o serviço do chatbot para treinar novamente: `docker compose up -d --build chatbot`.
3. Compare as métricas e teste frases escritas de formas diferentes.
4. Crie uma nova intenção (por exemplo, `garantia`), inclua exemplos no CSV e implemente a resposta correspondente em `chatbot.js`.
5. Observe o que acontece quando uma mensagem contém palavras de mais de uma intenção ou não se parece com os exemplos de treinamento.

**Relação com o notebook da aula:** o notebook original compara Regressão Logística e Árvore de Decisão usando o mesmo conjunto de intenções. Nesta versão integrada ao projeto WAHA, a classificação em tempo de execução foi implementada em JavaScript com Regressão Logística multiclasse e TF-IDF, para que os alunos não precisem instalar Python. A Árvore de Decisão continua podendo ser estudada e comparada no notebook.

**Limitação didática:** são apenas 120 exemplos controlados. A acurácia obtida no teste não garante desempenho em conversas reais; o dataset deve ser ampliado com variações linguísticas e exemplos coletados/validados com cuidado.
