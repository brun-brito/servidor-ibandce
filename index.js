const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Cache para armazenar as 3 últimas notícias
let cacheNoticias = [];

// Função para converter a imagem para PNG e armazenar localmente
async function converterImagemParaPng(imagemUrl, nomeArquivo) {
  try {
    const caminhoDiretorio = path.resolve(__dirname, 'imagens_cache');
    await fs.mkdir(caminhoDiretorio, { recursive: true });

    const response = await axios.get(imagemUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const caminhoImagem = path.join(caminhoDiretorio, `${nomeArquivo}.png`);
    
    await sharp(buffer).png().toFile(caminhoImagem);
    
    return `https://servidor-noticias-ibandce-2820808168f9.herokuapp.com/imagens/${nomeArquivo}.png`;
  } catch (error) {
    console.error('Erro ao converter imagem:', error);
    return null;
  }
}

// Função para limpar imagens não usadas
async function limparImagensNaoUsadas(noticiasAtuais) {
  try {
    const caminhoDiretorio = path.resolve(__dirname, 'imagens_cache');
    const arquivosNoDiretorio = await fs.readdir(caminhoDiretorio);

    // Obter os nomes das imagens das notícias atuais
    const imagensAtuais = noticiasAtuais.map(noticia => {
      const url = noticia.imagem.url;
      return path.basename(url);
    });

    // Remover arquivos que não estão nas notícias atuais
    for (const arquivo of arquivosNoDiretorio) {
      if (!imagensAtuais.includes(arquivo)) {
        await fs.unlink(path.join(caminhoDiretorio, arquivo));
      }
    }
  } catch (error) {
    console.error('Erro ao limpar imagens não usadas:', error);
  }
}

// Função para buscar as notícias mais recentes
async function atualizarNoticias() {
  try {
    const { data: noticias } = await axios.get(
      'https://ibandce.com.br/wp-json/minha-api/v1/categoria/midia-externa'
    );

    const noticiasOrdenadas = noticias.sort((a, b) =>
      new Date(b.imagem.date) - new Date(a.imagem.date)
    );

    const noticiasMaisRecentes = noticiasOrdenadas.slice(0, 4);

    for (let noticia of noticiasMaisRecentes) {
      const nomeArquivo = path.basename(noticia.imagem.url, path.extname(noticia.imagem.url));
      const caminhoImagemPng = await converterImagemParaPng(noticia.imagem.url, nomeArquivo);

      if (caminhoImagemPng) {
        noticia.imagem.url = caminhoImagemPng;
      }
    }

    // Limpar imagens não usadas
    await limparImagensNaoUsadas(noticiasMaisRecentes);

    // Atualizar o cache com as novas notícias
    cacheNoticias = combinarNoticias(cacheNoticias, noticiasMaisRecentes);
    console.log('Notícias atualizadas!');
  } catch (error) {
    console.error('Erro ao buscar notícias:', error);
  }
}

// Função para combinar as notícias antigas com as novas
function combinarNoticias(antigas, novas) {
  const combinadas = [...novas];

  // Preenche com antigas se houver menos de 3 notícias novas
  while (combinadas.length < 4 && antigas.length > 0) {
    combinadas.push(antigas.shift());
  }

  return combinadas;
}

// Agendamento da atualização a cada 1 hora
cron.schedule('0 * * * *', () => {
  console.log('Executando atualização de notícias após 1 hora');
  atualizarNoticias();
});

// Endpoint para servir as últimas 3 notícias
app.get('/noticias', (req, res) => {
  res.json(cacheNoticias);
});

// Endpoint para atualizar notícias manualmente
app.get('/atualizar-noticias', (req, res) => {
  console.log('Atualização manual de notícias requisitada');
  atualizarNoticias();
  res.send('Notícias atualizadas!');
});

// Servir o diretório "imagens_cache" como público
app.use('/imagens', express.static(path.join(__dirname, 'imagens_cache')));

// Iniciar o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Veja as notícias: LOCAL - http://localhost:${PORT}/noticias\nWEB: https://servidor-noticias-ibandce-2820808168f9.herokuapp.com/noticias`);
  atualizarNoticias(); // Primeira execução ao iniciar o servidor
});
