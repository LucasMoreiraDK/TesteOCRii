const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit'); 
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 3000;


app.use(express.json());

// Aplicar CORS nas rotas específicas
const corsOptions = {
  origin: [
    'https://front-end-placas.vercel.app',
    'https://webiinodedeployapi.onrender.com',
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
};

app.use('/cadastroPlaca', cors(corsOptions));
app.use('/relatorio/cidade/:cidade', cors(corsOptions));
app.use('/consulta/:placa', cors(corsOptions));


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });
const { parseISO, format } = require('date-fns'); 


// Configuração do MongoDB usando Mongoose
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://lucaslcs127:root@clusterdk.4joqwuj.mongodb.net/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const PlacaSchema = new mongoose.Schema({
  numeroPlaca: String,
  cidade: String,
  dataHora: String, // Armazenar a data como uma string formatada
});

const Placa = mongoose.model('Placa', PlacaSchema);

app.use(express.json());

// Rota para a página HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Rota para o upload da imagem
app.post('/cadastroPlaca', upload.single('imagem'), async (req, res) => {
  try {
    const { cidade } = req.body;
    const imagemPath = req.file.path;

    // Usar Tesseract.js para reconhecimento de caracteres na imagem
    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(imagemPath);

    // Remover espaços em branco e caracteres de nova linha do número da placa
    const numeroPlacaLimpo = text.replace(/\s+/g, '');

    // Criar um registro no banco de dados e formatar a data atual
    const dataAtualFormatada = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx");
    const novaPlaca = new Placa({
      numeroPlaca: numeroPlacaLimpo,
      cidade,
      dataHora: dataAtualFormatada, // Usar a data formatada aqui
    });
    await novaPlaca.save();

    res.status(200).json({ message: 'Placa cadastrada com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ocorreu um erro ao processar a placa' });
  }
});


//Rota para retornar em PDF os dados de uma cidade passada em parametro , tente testar com "juazeiro" como parametro
app.get('/relatorio/cidade/:cidade', async (req, res) => {
  try {
    const cidade = req.params.cidade;

    // Consulte o banco de dados para obter registros com a cidade especificada
    const registros = await Placa.find({ cidade });

    // Crie um novo documento PDF
    const doc = new PDFDocument();

    // Defina o nome do arquivo PDF gerado
    const pdfFileName = `relatorio_${cidade}_${format(new Date(), 'yyyyMMddHHmmss')}.pdf`;

    // Defina os cabeçalhos HTTP para fazer o navegador baixar o PDF
    res.setHeader('Content-disposition', `attachment; filename=${pdfFileName}`);
    res.setHeader('Content-type', 'application/pdf');

    // Crie o PDF com as informações dos registros
    doc.pipe(res);

    doc.fontSize(16).text(`Relatório de Registros - Cidade: ${cidade}`, { align: 'center' });

    registros.forEach((registro) => {
      doc.fontSize(12).text(`Número da Placa: ${registro.numeroPlaca}`);
      doc.fontSize(12).text(`Cidade: ${registro.cidade}`);
      const dataHoraFormatada = format(parseISO(registro.dataHora), "dd/MM/yyyy HH:mm:ss");
      doc.fontSize(12).text(`Data e Hora: ${dataHoraFormatada}`);
      doc.moveDown();
    });

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ocorreu um erro ao gerar o relatório' });
  }
});

//Rota para consultar placas
app.get('/consulta/:placa', async (req, res) => {
  try {
    const placa = req.params.placa;

    // Consulte o banco de dados para verificar se a placa existe
    const registro = await Placa.findOne({ numeroPlaca: placa });

    if (registro) {
      // Se a placa existe, retorne um JSON com uma mensagem de sucesso
      res.status(200).json({ message: 'Placa encontrada no banco de dados' });
    } else {
      // Se a placa não existe, retorne um JSON com uma mensagem de erro
      res.status(404).json({ message: 'Placa não encontrada no banco de dados' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ocorreu um erro ao consultar a placa' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
