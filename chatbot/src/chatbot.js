import { produtos, pedidos } from './data.js';
import { classificar, normalizar } from './nlp.js';

const moeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const encontrarProduto = (texto) => produtos.find((produto) => normalizar(texto).includes(normalizar(produto.nome)));

export function responder(texto) {
  const previsao = classificar(texto);
  const { intencao, confianca } = previsao;
  const produto = encontrarProduto(texto);
  let resposta;

  switch (intencao) {
    case 'saudacao':
      resposta = 'Olá! Sou o assistente da loja. Posso consultar preços, disponibilidade e pedidos. O que você precisa?';
      break;
    case 'preco':
      resposta = produto
        ? `${produto.nome}: ${moeda(produto.preco)}.`
        : `Qual produto você deseja consultar? Temos: ${produtos.map((p) => p.nome).join(', ')}.`;
      break;
    case 'estoque':
      resposta = produto
        ? (produto.estoque > 0 ? `Sim! Temos ${produto.estoque} unidade(s) de ${produto.nome} disponível(is).` : `No momento, ${produto.nome} está sem estoque.`)
        : `Qual produto deseja consultar? Temos: ${produtos.map((p) => p.nome).join(', ')}.`;
      break;
    case 'pedido': {
      const numero = String(texto).match(/\b\d{4,}\b/)?.[0];
      const pedido = pedidos.find((item) => item.numero === numero);
      resposta = !numero
        ? 'Informe o número do pedido. Exemplo: “Qual o status do pedido 1002?”'
        : pedido ? `O pedido ${numero} está: ${pedido.status}.` : `Não encontrei o pedido ${numero}. Verifique o número e tente novamente.`;
      break;
    }
    default:
      resposta = `Não consegui identificar sua solicitação com segurança. \nVocê pode perguntar sobre preço, estoque ou status de pedido.\n\n${produtos.map((p) => `• ${p.nome}`).join('\n')}`;
  }
  return { intencao, confianca, resposta, probabilidades: previsao.probabilidades };
}
