import express from 'express';
import { responder } from './chatbot.js';
import { produtos, pedidos } from './data.js';
const app = express();
app.use(express.json({ limit: '128kb' }));
app.use(express.static('public'));
const porta = Number(process.env.PORT || 3001);
const url = process.env.WAHA_URL || 'http://localhost:3000';
const chave = process.env.WAHA_API_KEY || '';
const sessao = process.env.WAHA_SESSION || 'default';
const enviar = process.env.SEND_ENABLED !== 'false';
const vistos = new Map();
async function enviarWhatsApp(chatId, text) {
  const resposta = await fetch(`${url}/api/sendText`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': chave },
    body: JSON.stringify({ session: sessao, chatId, text }), signal: AbortSignal.timeout(10000)
  });
  if (!resposta.ok) throw new Error(`WAHA HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 250)}`);
}
app.get('/health', (_, res) => res.json({ status: 'ok', envioWhatsApp: enviar }));
app.get('/api/produtos', (_, res) => res.json(produtos));
app.get('/api/pedidos/:numero', (req, res) => {
  const pedido = pedidos.find(p => p.numero === req.params.numero);
  res.status(pedido ? 200 : 404).json(pedido || { erro: 'Pedido não encontrado' });
});
app.post('/simular', (req, res) => {
  if (typeof req.body?.texto !== 'string') return res.status(400).json({ erro: 'Envie texto como string' });
  res.json(responder(req.body.texto));
});
app.post('/webhook', async (req, res) => {
  const evento = req.body;
  if (evento?.event !== 'message') return res.sendStatus(200);
  const mensagem = evento.payload || {};
  if (mensagem.fromMe || !mensagem.body || typeof mensagem.body !== 'string') return res.sendStatus(200);
  const chatId = mensagem.from;
  if (!chatId || chatId.endsWith('@g.us') || chatId === 'status@broadcast') return res.sendStatus(200);
  const id = mensagem.id?._serialized || mensagem.id;
  if (id && vistos.has(String(id))) return res.sendStatus(200);
  if (id) {
    vistos.set(String(id), Date.now());
    if (vistos.size > 1000) vistos.delete(vistos.keys().next().value);
  }
  const resultado = responder(mensagem.body);
  console.log(JSON.stringify({ chatId, texto: mensagem.body, intencao: resultado.intencao }));
  if (!enviar) return res.json({ simulado: true, ...resultado });
  try {
    await enviarWhatsApp(chatId, resultado.resposta);
    res.sendStatus(200);
  } catch (erro) {
    console.error('Falha ao responder:', erro.message);
    if (id) vistos.delete(String(id));
    res.status(502).json({ erro: 'Falha ao enviar resposta' });
  }
});
app.listen(porta, '0.0.0.0', () => console.log(`Chatbot ouvindo na porta ${porta}`));
