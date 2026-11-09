# Chatbot WhatsApp com WAHA e NLP — projeto da aula

Projeto didático com **WAHA + Node.js + Express + Docker Compose**. Um chatbot recebe mensagens do WhatsApp, classifica a intenção com **TF-IDF + Regressão Logística** (implementados em JavaScript) e responde com dados de um catálogo e de pedidos simulados.

Cada aluno ou grupo executa sua própria cópia do projeto e conecta o próprio número de WhatsApp à sua instância local da WAHA. Não é preciso instalar Python, Node.js ou bibliotecas no computador: tudo roda em containers.

> **Sobre a sessão já conectada pelo professor:** este projeto é uma instalação independente. Ele não altera nem importa a sessão do computador do professor, que fica em outro volume Docker e tem outro nome. Cada aluno cria e autentica uma sessão própria chamada `default` na sua instalação.

## 1. Arquitetura

```text
WhatsApp do aluno
       |
       | mensagem recebida
       v
WAHA (container "waha")
       |
       | POST http://chatbot:3001/webhook
       v
Node.js + Express (container "chatbot")
       |
       +--> nlp.js       classifica a intenção (TF-IDF + Regressão Logística)
       +--> chatbot.js   monta a resposta
       +--> data.js      consulta catálogo e pedidos simulados
       |
       | POST http://waha:3000/api/sendText
       v
WAHA --> WhatsApp de quem enviou a mensagem
```

Os dois containers estão na mesma rede do Docker Compose e se encontram pelo nome do serviço (`waha` e `chatbot`). Por isso não é necessário ngrok nem `host.docker.internal`. Cada instalação tem seus próprios containers, chave de API, volume de sessão e QR Code.

## 2. Requisitos

- Docker Desktop instalado e em execução (Windows, macOS ou Linux), com Docker Compose.
- Internet para baixar as imagens.
- Um celular com WhatsApp para ler o QR Code. Prefira um número de teste (veja [Segurança](#14-segurança-e-uso-responsável)).

Se o laboratório não permitir instalar o Docker Desktop, o professor ou o administrador precisa prepará-lo antes da aula.

## 3. Estrutura do projeto

```text
chatbot-waha-nlp/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
└── chatbot/
    ├── Dockerfile
    ├── package.json
    ├── datasets/
    │   └── dados_treinamento.csv
    ├── public/
    │   └── index.html
    └── src/
        ├── server.js
        ├── nlp.js
        ├── chatbot.js
        └── data.js
```

| Arquivo | Função |
|---|---|
| `docker-compose.yml` | Sobe os serviços `waha` e `chatbot` e configura o webhook global. |
| `.env.example` | Modelo das variáveis de ambiente. Copie para `.env`. |
| `chatbot/Dockerfile` | Imagem `node:22-alpine` com o Express (única dependência). |
| `src/server.js` | Express: webhook, simulador, endpoints de teste e envio para a WAHA. |
| `src/nlp.js` | Normalização, TF-IDF, treino e avaliação da Regressão Logística. |
| `src/chatbot.js` | Regras que transformam a intenção em resposta. |
| `src/data.js` | Catálogo de produtos e pedidos fictícios. |
| `datasets/dados_treinamento.csv` | 120 frases rotuladas usadas no treino. |
| `public/index.html` | Simulador no navegador. |

## 4. Preparar o projeto

1. Abra um terminal na pasta que contém o `docker-compose.yml`.
2. Copie o arquivo de ambiente.

   macOS/Linux:

   ```bash
   cp .env.example .env
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Gere uma chave aleatória.

   macOS/Linux:

   ```bash
   openssl rand -hex 24
   ```

   Windows PowerShell:

   ```powershell
   -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
   ```

4. Edite o `.env` e coloque a chave gerada em `WAHA_API_KEY`.

> O `.env.example` traz uma chave de exemplo apenas para mostrar o formato. **Substitua-a sempre** por uma chave gerada por você. O `.env` já está no `.gitignore` e não deve ser publicado.

### Variáveis do `.env`

| Variável | Padrão | Para que serve |
|---|---|---|
| `WAHA_API_KEY` | — (obrigatória) | Chave da API. O Compose a entrega à WAHA (como `WHATSAPP_API_KEY`) e ao chatbot, que a envia no header `X-Api-Key`. |
| `WAHA_IMAGE` | `devlikeapro/waha:latest` | Imagem da WAHA conforme a arquitetura do computador. |
| `WHATSAPP_DEFAULT_ENGINE` | `WEBJS` | Engine usado pela WAHA. |
| `WAHA_SESSION` | `default` | Nome da sessão. Deve ser igual ao nome criado no Dashboard. |
| `WAHA_PORT` | `3000` | Porta local da WAHA. |
| `CHATBOT_PORT` | `3001` | Porta local do chatbot. |
| `SEND_ENABLED` | `true` | `true` envia respostas ao WhatsApp; `false` só processa o webhook. |
| `COMPOSE_PROJECT_NAME` | `chatbot-aula` | Prefixo dos nomes dos containers (opcional). |

Se `WAHA_API_KEY` não estiver definida, o Compose interrompe a inicialização com a mensagem `Defina WAHA_API_KEY no arquivo .env`.

### Imagem da WAHA por arquitetura

Ajuste `WAHA_IMAGE` no `.env`:

- Mac com Apple Silicon (M1/M2/M3/M4): `devlikeapro/waha:arm`
- Windows/Linux x86_64 (Intel/AMD): `devlikeapro/waha:latest`

Não use a imagem `arm` em computadores Intel/AMD. Para outras arquiteturas e tags, consulte a documentação oficial.

## 5. Subir o ambiente

Na pasta do projeto:

```bash
docker compose up -d --build
```

O `--build` constrói a imagem do chatbot. Repita-o sempre que alterar o código ou o CSV.

Verifique os containers:

```bash
docker compose ps
```

Acompanhe os logs (cada comando em uma janela):

```bash
docker compose logs -f waha
docker compose logs -f chatbot
```

Ao iniciar, o chatbot treina o classificador e mostra no log algo como:

```text
[NLP] Dataset: 120 exemplos | Treino: 88 | Teste: 32
[NLP] Acurácia da avaliação: 100.0%
Chatbot ouvindo na porta 3001
```

## 6. Conectar o WhatsApp do aluno

1. Abra http://localhost:3000/dashboard.
2. Conecte o Dashboard à API usando a chave definida em `WAHA_API_KEY`, se for solicitada.
3. Na área **Sessions**, crie uma sessão chamada exatamente `default` (o valor de `WAHA_SESSION`).
4. Inicie a sessão e aguarde o estado `SCAN_QR_CODE`.
5. Exiba o QR Code e leia pelo celular: **WhatsApp › Dispositivos conectados › Conectar dispositivo**.
6. Aguarde o estado `WORKING`. O chatbot só responde nesse estado.

O Compose já define o webhook global da WAHA para `http://chatbot:3001/webhook`, com o evento `message`. **Não configure um segundo webhook igual na sessão**, ou cada mensagem chegará duas vezes ao chatbot.

## 7. Como funciona o classificador

O arquivo `chatbot/datasets/dados_treinamento.csv` tem 120 mensagens rotuladas, 30 para cada uma das quatro intenções: `saudacao`, `preco`, `estoque` e `pedido`.

Quando o container do chatbot inicia, o `nlp.js`:

1. lê o CSV;
2. normaliza as mensagens (minúsculas, sem acentos e sem pontuação);
3. gera características com TF-IDF, usando palavras e pares de palavras (bigramas);
4. separa os dados de forma estratificada e reproduzível em treino (75%) e teste (25%);
5. treina uma Regressão Logística multiclasse (softmax), implementada em JavaScript, sem bibliotecas de aprendizado de máquina;
6. mostra a acurácia da avaliação no log;
7. treina novamente com todos os exemplos, e é esse modelo final que classifica as mensagens recebidas.

O classificador retorna a intenção, a confiança e a probabilidade de cada classe. **Se a confiança for menor que 0,42**, a intenção passa a ser `desconhecida` e o bot pede que o usuário reformule.

Depois da classificação, o `chatbot.js` aplica regras simples: procura o nome de um produto do catálogo no texto (para `preco` e `estoque`) e extrai um número de pedido com 4 ou mais dígitos (para `pedido`). Os dados vêm de `data.js`:

| Produto | Preço | Estoque |
|---|---|---|
| Teclado | R$ 129,90 | 12 |
| Mouse | R$ 79,90 | 0 |
| Headset | R$ 199,90 | 7 |

Pedidos de exemplo: `1001` (Em separação), `1002` (Enviado) e `1003` (Entregue).

### Exemplos de resultado

| Mensagem | Intenção | Confiança | Resposta |
|---|---|---|---|
| Oi, tudo bem? | `saudacao` | 75% | Apresentação do assistente |
| Quanto custa o teclado? | `preco` | 84% | Teclado: R$ 129,90. |
| Vocês ainda têm mouse disponível? | `estoque` | 69% | No momento, Mouse está sem estoque. |
| Onde está meu pedido 1002? | `pedido` | 81% | O pedido 1002 está: Enviado. |
| Quero saber o valor do notebook | `preco` | 67% | Lista os produtos disponíveis (notebook não está no catálogo). |
| Quero falar com um atendente sobre a garantia | `desconhecida` | 36% | Pede para reformular. |

A última mensagem cai em `desconhecida` porque não existe intenção de atendimento ou garantia no dataset. Isso é esperado: o modelo não deve inventar uma classe que não aprendeu.

### Limitações

- São apenas 120 exemplos controlados. A acurácia do teste não garante bom desempenho em conversas reais.
- Frases curtas ou fora do padrão podem ficar abaixo do limite mesmo quando a intenção parece óbvia (por exemplo, `estoque do mouse` sai como `desconhecida`).
- Frases fora do assunto podem passar do limite e receber uma intenção errada (por exemplo, `qual a capital da França` sai como `pedido`, com 47%).
- O limite de 0,42 equilibra esses dois tipos de erro e deve ser revisto sempre que o dataset mudar.

## 8. Testar sem WhatsApp

Com os containers ativos, os endereços abaixo funcionam no seu computador:

| Endereço | O que é |
|---|---|
| http://localhost:3001 | Simulador no navegador |
| http://localhost:3001/health | Saúde do chatbot e se o envio está ativo |
| http://localhost:3001/api/produtos | Catálogo fictício |
| http://localhost:3001/api/pedidos/1002 | Pedido de exemplo (um número inexistente retorna 404) |
| http://localhost:3000/dashboard | Dashboard da WAHA |
| http://localhost:3000 | Swagger da WAHA |

Para testar a classificação pelo terminal, envie uma mensagem para `/simular`. Nada é enviado ao WhatsApp.

macOS/Linux:

```bash
curl -X POST http://localhost:3001/simular \
  -H 'Content-Type: application/json' \
  -d '{"texto":"Quanto custa o teclado?"}'
```

Windows PowerShell:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3001/simular -ContentType 'application/json' -Body '{"texto":"Quanto custa o teclado?"}'
```

A resposta traz `intencao`, `confianca`, `resposta` e `probabilidades`.

## 9. Testar o webhook sem enviar mensagens

1. No `.env`, altere `SEND_ENABLED=false`.
2. Recrie o serviço do chatbot:

   ```bash
   docker compose up -d --build chatbot
   ```

3. Envie um evento de teste:

   ```bash
   curl -X POST http://localhost:3001/webhook \
     -H 'Content-Type: application/json' \
     -d '{"event":"message","payload":{"id":"teste-1","from":"5567999999999@c.us","fromMe":false,"body":"preço do teclado"}}'
   ```

Com `SEND_ENABLED=false`, o webhook classifica a mensagem, registra o resultado no log e devolve o JSON da resposta, sem enviar nada ao WhatsApp. Para voltar ao envio real, altere para `SEND_ENABLED=true` e execute `docker compose up -d`.

Se enviar o mesmo `id` duas vezes, a segunda chamada é ignorada: o webhook guarda os ids já processados para não responder em duplicidade. Use um `id` novo a cada teste.

## 10. Testar com mensagens reais

Com a sessão em `WORKING` e `SEND_ENABLED=true`:

1. Envie uma mensagem **de outro número** para o WhatsApp conectado à WAHA. Mensagens enviadas pelo próprio número conectado chegam com `fromMe` e são ignoradas.
2. Acompanhe o log:

   ```bash
   docker compose logs -f chatbot
   ```

3. O chatbot recebe o evento, identifica a intenção e chama `POST /api/sendText` da WAHA.
4. A resposta chega ao WhatsApp de quem enviou a mensagem.

O webhook ignora:

- eventos que não sejam `message`;
- mensagens do próprio bot (`fromMe`), para evitar loop;
- mensagens sem texto;
- grupos (`@g.us`) e atualizações de status (`status@broadcast`);
- mensagens com `id` já processado.

## 11. Atividades sugeridas

1. Acrescente pelo menos cinco novas frases para cada intenção no CSV, reconstrua o chatbot (`docker compose up -d --build chatbot`) e compare a acurácia no log.
2. Crie a intenção `horario`: inclua exemplos no CSV e implemente a resposta em `chatbot.js`.
3. Adicione um produto em `data.js` e consulte preço e estoque.
4. Crie a intenção `frete` e simule o cálculo.
5. Teste frases ambíguas ou com palavras de mais de uma intenção e avalie o efeito de mudar o limite de 0,42 em `nlp.js`.
6. Compare a Regressão Logística com uma classificação por palavras-chave ou com a Árvore de Decisão do notebook original da aula.
7. Integre uma API pública ou simulada para consultar dados externos.

## 12. Problemas comuns

| Sintoma | O que verificar |
|---|---|
| `no configuration file provided` | O comando foi executado fora da pasta do `docker-compose.yml`. |
| `Defina WAHA_API_KEY no arquivo .env` | O `.env` não existe ou está sem a chave. |
| `401 Unauthorized` no log do chatbot | A chave da WAHA difere da do chatbot. Confira com `docker compose exec waha printenv WHATSAPP_API_KEY`, sem publicar o resultado. |
| Sessão parada em `STARTING` | Veja `docker compose logs --tail=200 waha`. Confira a imagem (`arm` ou `latest`) e erros do Chromium/Puppeteer. |
| Sessão parada em `SCAN_QR_CODE` | Conclua a leitura do QR Code no celular. |
| Porta 3000 ou 3001 ocupada | Altere `WAHA_PORT` e/ou `CHATBOT_PORT` no `.env`. |
| Conflito com nomes de containers | Altere `COMPOSE_PROJECT_NAME` no `.env`. |
| O bot não responde | A sessão está em `WORKING`? `SEND_ENABLED=true`? A mensagem veio de outro número e não de um grupo? |
| Respostas em dobro | Há um webhook configurado também na sessão. Remova-o e mantenha só o global do Compose. |

## 13. Encerrar e preservar a sessão

Parar os containers sem apagar a sessão:

```bash
docker compose down
```

Iniciar novamente:

```bash
docker compose up -d
```

**Não use `docker compose down -v`** se quiser preservar a autenticação: o `-v` apaga o volume `waha_sessions` e será preciso ler o QR Code de novo.

## 14. Segurança e uso responsável

- Mantenha a chave de API privada. Gere a sua, guarde-a só no `.env` e não publique esse arquivo.
- Não exponha as portas à rede pública. O Compose usa `127.0.0.1` de propósito, para que só o próprio computador acesse.
- O webhook do exemplo é didático e não valida assinatura nem segredo de origem. Não use esta configuração diretamente em produção.
- Use apenas números e conversas com autorização. Evite disparos em massa.
- A WAHA automatiza o WhatsApp Web, um mecanismo não oficial. Isso pode levar a bloqueio ou restrição da conta e a mudanças de compatibilidade. Na aula, prefira números de teste ou dedicados, com consentimento, e verifique os termos aplicáveis antes de usar contas pessoais. Para uso comercial crítico, avalie a WhatsApp Business Platform oficial.

## 15. Documentação oficial

- WAHA Quick Start: https://waha.devlike.pro/docs/overview/quick-start/
- WAHA Engines e imagens Docker: https://waha.devlike.pro/docs/how-to/engines/
- WAHA Events e Webhooks: https://waha.devlike.pro/docs/how-to/events/
- WAHA Sessions: https://waha.devlike.pro/docs/how-to/sessions/