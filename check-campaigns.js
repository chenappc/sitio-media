const https = require('https');

const token = 'EAAKqJ182ZBKEBQ5euJtUQZBy3bq9TcvYCHgPJjA0MZCaUkePg5LkZBY50vhfqUtiF09jLEvAqles0VOozmG9t6wtmZBQPOtTyxOBi9sLWTgWmOgkhp5I8iYZA9SpZCNWxytSq4c2JZAZAidtg9bdynAUYZAIGLreeOM6Tgrk0JPuBW9BVdrouohcM4EknBwYgWZC8hf4YJNtcEZD';
const filtering = JSON.stringify([{"field":"name","operator":"CONTAIN","value":"Sitio.media"}]);
const url = `https://graph.facebook.com/v19.0/act_278073712624915/campaigns?fields=id,name,status&filtering=${encodeURIComponent(filtering)}&access_token=${token}`;

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      console.log(JSON.stringify(JSON.parse(data), null, 2));
    } catch(e) {
      console.log(data);
    }
  });
});
