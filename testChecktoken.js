const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://lucaslcs127:root@clusterdk.4joqwuj.mongodb.net/test";
const client = new MongoClient(uri, { useNewUrlParser: true });

let controlador = 0;

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

// Substitua 'seu_token' pelo valor do token que você deseja verificar na coleção
const seu_token = '7566e01f6c8e692eb15280420bf889d3cbc239858967c1f44b48cc968b03b421cc6727887bacb64638150f1c131d569b16aa150f23c893a19a6cfec397451a0e';

// Chame a função de forma assíncrona e aguarde que ela termine
checkTokenInCollection(seu_token).then(() => {
  console.log(controlador);
});
