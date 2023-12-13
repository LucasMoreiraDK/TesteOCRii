const express = require('express');
const multer = require('multer');
const path = require('path');
const PDFDocument = require('pdfkit'); 
const cors = require('cors');
const fs = require('fs');
const app = express();
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const MongoClient = require('mongodb').MongoClient;
const fetch = require('isomorphic-fetch');


/*
Para testar alguma rota localmente, após dar um "node index.js", use o JSON para a rota POST "http://localhost:3000/login":

{
  "email": "lucashhj@exa4mple.coms",
  "senha": "minhasenhhjhja2041s"
}
*/



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


const uri = "mongodb+srv://lucaslcs127:root@clusterdk.4joqwuj.mongodb.net/test";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// Variável global para armazenar os tokens
let tokensList = [];
let tokenNow = "";

// Função para buscar e armazenar os tokens na variável global
async function getTokens() {
  try {
    await client.connect();
    const database = client.db('test');
    const collection = database.collection('tokens');

    const tokens = await collection.find({}).toArray();
    tokensList = tokens.map(token => token.token);

    console.log('Tokens recuperados com sucesso:', tokensList);
  } catch (err) {
    console.error('Erro ao recuperar os tokens:', err);
  } finally {
    client.close();
  }
}

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
    if (controlador !== 1) {
      return res.status(401).json({ message: 'Acesso não autorizado' });
    }
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
    if (controlador !== 1) {
      return res.status(401).json({ message: 'Acesso não autorizado' });
    }
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
    if (controlador !== 1) {
      return res.status(401).json({ message: 'Acesso não autorizado' });
    }

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

//Temperatura
app.get('/temperatura', async (req, res) => {
  try {
    const response = await fetch('https://api.thingspeak.com/channels/2373827/feeds.json?results');

    if (!response.ok) {
      throw new Error('Não foi possível obter os dados da API.');
    }

    const data = await response.json();
    const feeds = data.feeds;

    if (feeds && feeds.length > 0) {
      const latestEntry = feeds[feeds.length - 1];
      const temp = latestEntry.field1;
      console.log('A temperatura atual é:', temp);
      res.status(200).json({
        message: 'A temperatura atual é:',
        temp
      });
    } else {
      console.log('Nenhuma entrada encontrada.');
      res.status(404).json({ error: 'Nenhuma entrada encontrada.' });
    }
  } catch (error) {
    console.error('Ocorreu um erro:', error);
    res.status(500).json({ error: 'Ocorreu um erro ao processar a requisição.' });
  }
});

//Luminosidade
app.get('/Luminosidade', async (req, res) => {
  try {
    const response = await fetch('https://api.thingspeak.com/channels/2378150/feeds.json?results');

    if (!response.ok) {
      throw new Error('Não foi possível obter os dados da API.');
    }

    const data = await response.json();
    const feeds = data.feeds;

    if (feeds && feeds.length > 0) {
      const latestEntry = feeds[feeds.length - 1];
      const lux = latestEntry.field1;
      console.log('A Luminosidade atual é:', lux);
      res.status(200).json({
        message: 'A Luminosidade atual é:',
        lux
      });
    } else {
      console.log('Nenhuma entrada encontrada.');
      res.status(404).json({ error: 'Nenhuma entrada encontrada.' });
    }
  } catch (error) {
    console.error('Ocorreu um erro:', error);
    res.status(500).json({ error: 'Ocorreu um erro ao processar a requisição.' });
  }
});
//---

//logim e cadastro:
let controlador = 0;
// Define um modelo (schema) para os usuários
const User = mongoose.model('User', {
  email: String,
  senha: String,
});

// Rota POST para cadastro de usuário
app.post('/cadastro', async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Verifica se o email já está cadastrado
    const userExists = await User.findOne({ email });

    if (userExists) {
      // Se o email já estiver em uso, retorna um erro
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Criptografa a senha usando o bcrypt antes de armazená-la
    const hashedPassword = bcrypt.hashSync(senha, 10);

    // Cria um novo usuário no banco de dados usando o modelo User
    const newUser = new User({ email, senha: hashedPassword });
    await newUser.save();

    // Retorna uma resposta de sucesso
    res.status(201).json({ message: 'Usuário cadastrado com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

//model do token ao logim 
const Token = mongoose.model('Token', {
  email: String,
  token: String,
});


// Rota POST para login
app.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    // Verifica se o email existe no banco de dados
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Dados incorretos' });
      controlador = 0;
    }

    // Verifica se a senha fornecida corresponde à senha no banco de dados
    const passwordMatch = bcrypt.compareSync(senha, user.senha);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Dados incorretos' });
      controlador = 0;
    }

    // Gera um token aleatório
    const token = crypto.randomBytes(64).toString('hex');

    // Salva o token na coleção "tokens" no MongoDB
    const tokenDocument = new Token({ email: user.email, token });
    await tokenDocument.save();

    tokenNow = token;
    controlador = 1;
   

    // Retorna o token como resposta
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
  
});





async function checkTokenInCollection(token) {
  try {
    await client.connect();

    const database = client.db('test'); // Substitua 'seu_database' pelo nome do seu banco de dados
    const collection = database.collection('tokens');

    const tokenDocument = await collection.findOne({ token: token });

    if (tokenDocument) {
      console.log('O token está na coleção.');
      controlador = 1;
    } else {
      console.log('O token não foi encontrado na coleção.');
      controlador = 0;
    }
  } finally {
    await client.close();
  }
}

checkTokenInCollection(tokenNow).then(() => {
  console.log(controlador);
});
