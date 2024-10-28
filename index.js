const express = require('express');
const axios = require('axios');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache para armazenar as 3 últimas notícias
let cacheNoticias = [];

// Função para buscar as notícias mais recentes
async function atualizarNoticias() {
  try {
    const { data: noticias } = await axios.get(
      'https://ibandce.com.br/wp-json/minha-api/v1/categoria/midia-externa'
    );

    // Ordenar as notícias por data (do mais recente para o mais antigo)
    const noticiasOrdenadas = noticias.sort((a, b) =>
      new Date(b.imagem.date) - new Date(a.imagem.date)
    );

    // Pegar as 3 mais recentes
    const noticiasMaisRecentes = noticiasOrdenadas.slice(0, 3);

    // Atualizar o cache, mantendo as anteriores se necessário
    console.log('Iniciando atualização...');
    cacheNoticias = combinarNoticias(cacheNoticias, noticiasMaisRecentes);
    console.log('Cache atualizado!');
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
  }
}

// Função para combinar as notícias antigas com as novas
function combinarNoticias(antigas, novas) {
  const combinadas = [...novas];

  // Preenche com antigas se houver menos de 3 notícias novas
  while (combinadas.length < 3 && antigas.length > 0) {
    combinadas.push(antigas.shift());
  }

  return combinadas;
}

// Agendamento da atualização a cada 1 hora
cron.schedule('0 * * * *', () => {
  console.log('Executando tarefa de atualização de notícias');
  atualizarNoticias();
});

// Endpoint para servir as últimas 3 notícias
app.get('/noticias', (req, res) => {
  res.json(cacheNoticias);
});

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  atualizarNoticias(); // Primeira execução ao iniciar o servidor
});
