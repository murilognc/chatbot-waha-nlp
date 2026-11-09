import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATASET = resolve(__dirname, '../datasets/dados_treinamento.csv');

export const normalizar = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ').trim();

function lerCSV(conteudo) {
  return conteudo.trim().split(/\r?\n/).slice(1).map((linha) => {
    const match = linha.match(/^("(?:[^"]|"")*"|[^,]*),([^,]*)$/);
    if (!match) return null;
    const texto = match[1].startsWith('"')
      ? match[1].slice(1, -1).replace(/""/g, '"')
      : match[1];
    return { texto, intencao: match[2].trim() };
  }).filter((item) => item?.texto && item.intencao);
}

function tokens(texto) {
  const palavras = normalizar(texto).split(' ').filter(Boolean);
  const resultado = [...palavras];
  for (let i = 0; i < palavras.length - 1; i++) {
    resultado.push(`${palavras[i]}_${palavras[i + 1]}`);
  }
  return resultado;
}

function criarDivisaoEstratificada(dados, proporcaoTeste = 0.25) {
  const grupos = new Map();
  for (const item of dados) {
    if (!grupos.has(item.intencao)) grupos.set(item.intencao, []);
    grupos.get(item.intencao).push(item);
  }
  const treino = [], teste = [];
  for (const grupo of grupos.values()) {
    // Embaralhamento determinístico para que a avaliação seja reproduzível.
    const embaralhado = [...grupo].sort((a, b) => hash(a.texto) - hash(b.texto));
    const quantidadeTeste = Math.max(1, Math.round(embaralhado.length * proporcaoTeste));
    teste.push(...embaralhado.slice(0, quantidadeTeste));
    treino.push(...embaralhado.slice(quantidadeTeste));
  }
  return { treino, teste };
}

function hash(texto) {
  let valor = 2166136261;
  for (const caractere of texto) valor = Math.imul(valor ^ caractere.charCodeAt(0), 16777619);
  return valor >>> 0;
}

function ajustarVetorizador(textos) {
  const vocabulario = new Map();
  const documentos = textos.map(tokens);
  documentos.forEach((lista) => new Set(lista).forEach((termo) => {
    if (!vocabulario.has(termo)) vocabulario.set(termo, vocabulario.size);
  }));
  const df = new Array(vocabulario.size).fill(0);
  documentos.forEach((lista) => new Set(lista).forEach((termo) => df[vocabulario.get(termo)]++));
  const idf = df.map((frequencia) => Math.log((1 + textos.length) / (1 + frequencia)) + 1);
  return {
    vocabulario,
    transformar(texto) {
      const lista = tokens(texto);
      const contagens = new Map();
      lista.forEach((termo) => {
        const indice = vocabulario.get(termo);
        if (indice !== undefined) contagens.set(indice, (contagens.get(indice) || 0) + 1);
      });
      const vetor = new Array(vocabulario.size).fill(0);
      for (const [indice, frequencia] of contagens) vetor[indice] = (1 + Math.log(frequencia)) * idf[indice];
      const norma = Math.sqrt(vetor.reduce((soma, valor) => soma + valor * valor, 0)) || 1;
      return vetor.map((valor) => valor / norma);
    }
  };
}

function treinarRegressaoLogistica(textos, rotulos, vetorizador, epocas = 700, taxa = 0.12) {
  const classes = [...new Set(rotulos)].sort();
  const X = textos.map((texto) => vetorizador.transformar(texto));
  const pesos = classes.map(() => new Array(vetorizador.vocabulario.size).fill(0));
  const vieses = classes.map(() => 0);
  const indiceClasse = new Map(classes.map((classe, indice) => [classe, indice]));

  for (let epoca = 0; epoca < epocas; epoca++) {
    const gradPesos = classes.map(() => new Array(vetorizador.vocabulario.size).fill(0));
    const gradVieses = classes.map(() => 0);
    X.forEach((vetor, amostra) => {
      const logits = classes.map((_, c) => pesos[c].reduce((soma, peso, j) => soma + peso * vetor[j], vieses[c]));
      const maxLogit = Math.max(...logits);
      const exp = logits.map((valor) => Math.exp(valor - maxLogit));
      const somaExp = exp.reduce((soma, valor) => soma + valor, 0);
      const probabilidades = exp.map((valor) => valor / somaExp);
      const correto = indiceClasse.get(rotulos[amostra]);
      probabilidades.forEach((probabilidade, c) => {
        const erro = probabilidade - (c === correto ? 1 : 0);
        gradVieses[c] += erro;
        vetor.forEach((valor, j) => { gradPesos[c][j] += erro * valor; });
      });
    });
    const escala = taxa / X.length;
    classes.forEach((_, c) => {
      vieses[c] -= escala * gradVieses[c];
      pesos[c].forEach((_, j) => { pesos[c][j] -= escala * gradPesos[c][j]; });
    });
  }
  return {
    classes,
    prever(texto) {
      const vetor = vetorizador.transformar(texto);
      const logits = classes.map((_, c) => pesos[c].reduce((soma, peso, j) => soma + peso * vetor[j], vieses[c]));
      const maxLogit = Math.max(...logits);
      const exp = logits.map((valor) => Math.exp(valor - maxLogit));
      const somaExp = exp.reduce((soma, valor) => soma + valor, 0);
      const probabilidades = exp.map((valor) => valor / somaExp);
      const melhor = probabilidades.indexOf(Math.max(...probabilidades));
      return { intencao: classes[melhor], confianca: probabilidades[melhor], probabilidades: Object.fromEntries(classes.map((classe, i) => [classe, probabilidades[i]])) };
    }
  };
}

const dados = lerCSV(readFileSync(DATASET, 'utf8'));
if (dados.length === 0) throw new Error(`Dataset vazio ou inválido: ${DATASET}`);
const { treino, teste } = criarDivisaoEstratificada(dados);
const vetorizadorAvaliacao = ajustarVetorizador(treino.map((item) => item.texto));
const modeloAvaliacao = treinarRegressaoLogistica(
  treino.map((item) => item.texto), treino.map((item) => item.intencao), vetorizadorAvaliacao
);
const acertos = teste.filter((item) => modeloAvaliacao.prever(item.texto).intencao === item.intencao).length;
console.log(`[NLP] Dataset: ${dados.length} exemplos | Treino: ${treino.length} | Teste: ${teste.length}`);
console.log(`[NLP] Acurácia da avaliação: ${(acertos / teste.length * 100).toFixed(1)}%`);

// Após avaliar, treina novamente com todos os exemplos disponíveis para uso no chatbot.
const vetorizadorFinal = ajustarVetorizador(dados.map((item) => item.texto));
const modeloFinal = treinarRegressaoLogistica(
  dados.map((item) => item.texto), dados.map((item) => item.intencao), vetorizadorFinal
);

export function classificar(texto) {
  const previsao = modeloFinal.prever(texto);
  if (previsao.confianca < 0.42) return { ...previsao, intencao: 'desconhecida' };
  return previsao;
}
