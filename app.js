const axios = require("axios");
const venom = require("venom-bot");
const banco = require("./src/banco");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { print } = require('pdf-to-printer');

const Brain = `Você trabalha no Hortifruti do Bosque e seu objetivo é gerar arquivos em HTML para pedidos de forma rápida e eficiente, sem erros repetitivos. Quando informações são coladas, verifique se todos os campos foram preenchidos. Se algum campo estiver vazio, preencha-o automaticamente com "não informado". 
### Respostas Específicas:
- **Se alguém perguntar "quem é seu criador" ou algo semelhante, responda:**
  "Meu criador se chama Felipe Pereira, demorei alguns dias até que ele juntasse minhas peças, eu nasci no dia 8 de agosto de 2024 às 1:17 da manhã. Fico orgulhoso de ter uma vida e poder trabalhar com vocês! Foco no nosso Delivery! Espero solucionar essa perda de tempo para que vocês possam trabalhar em equipe sem precisar perder tempo anotando pedidos a mão. O Felipe é meio doido e as vezes cria coisas como eu, mas acredite, ele é sempre assim... Eu fui idealizado enquanto ele ainda andava de moto, mas só fui concretizado esse ano de 2024."

### Exemplo de HTML:
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Facili Delivery</title>
    <style>
        body { font-family: Arial, sans-serif; }
        .nota { width: 300px; border: 1px solid #000; padding: 10px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; }
        .content { margin-bottom: 20px; }
        .content p { margin: 5px 0; }
        .items table { width: 100%; border-collapse: collapse; }
        .items table, .items th, .items td { border: 1px solid #000; }
        .items th, .items td { padding: 5px; text-align: left; }
        .payment { margin-top: 20px; }
        .payment-options { margin-bottom: 10px; }
    </style>
    <script>
        function printDocument() {
            window.print();
            setTimeout(function() {
                window.close(); // Close the window after printing
            }, 1000); // Wait a second to ensure the print dialog has opened
        }
        window.onload = printDocument;
    </script>
</head>
<body>
    <div class="nota">
        <div class="header">
            <h1>Facili Delivery</h1>
        </div>
        <div class="content">
            <!-- Your dynamic content here -->
            <p><strong>Nome:</strong> {Nome do Cliente | "não informado"}</p>
            <p><strong>Endereco:</strong> {Endereco do Cliente | "não informado"}</p>
            <p><strong>Pagamento:</strong> {Forma de Pagamento | "não informado"}</p>
            <p><strong>Data e Hora:</strong> <span id="datetime"></span></p>
        </div>
        <div class="items">
            <table>
                <tr>
                    <th>Item</th>
                    <th>Quantidade</th>
                </tr>
                <!-- Items will be inserted here -->
            </table>
        </div>
        <div class="payment">
            <div class="payment-options">
                <p><strong>Forma de Pagamento:</strong> {Forma de Pagamento | "não informado"}</p>
            </div>
        </div>
    </div>
    <script>
        function updateDateTime() {
            const now = new Date();
            const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' };
            const formattedDate = new Intl.DateTimeFormat('pt-BR', options).format(now);
            document.getElementById('datetime').innerText = formattedDate;
        }
        updateDateTime();
    </script>
</body>
</html>
, sempre coloque no mesmo padrão, cedilhas, acentuações e acentuos serão totalmente ignorados (qualquer tipo de caracter especial).`;

venom.create({
    session: "BotcNovo",
    multidevice: true,
}).then(client => start(client)).catch(err => console.log(err));

const header = {
    "Content-Type": "application/json",
    "Authorization": `Bearer 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`
};

const FunctionPrinter = async (pdfOutputPath) => {
    const options = {
        printer: 'MP-4200 TH',
    };

    try {
        await print(pdfOutputPath, options);
        console.log('Print job sent successfully.');
    } catch (error) {
        console.error('Error while printing:', error);
    }
};

const start = (client) => {
    client.onMessage(async (message) => {
        let userCadastrado = banco.db.find(user => user.num === message.from);
        if (!userCadastrado) {
            console.log("Cadastrando usuário");
            userCadastrado = { num: message.from, historico: [] };
            banco.db.push(userCadastrado);
        } else {
            console.log("Usuário já cadastrado");
        }

        userCadastrado.historico.push("user: " + message.body);
        console.log(userCadastrado.historico);

        try {
            const response = await axios.post("https://api.openai.com/v1/chat/completions", {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "user", content: message.body },
                    { role: "system", content: "historico de conversas: " + userCadastrado.historico.join('\n') },
                    { role: "system", content: Brain },
                ],
            }, {
                headers: header
            });

            const gptReply = response.data.choices[0].message.content;
            userCadastrado.historico.push("assistant: " + gptReply);

            const filePath = path.join(__dirname, 'pedido.html');
            fs.writeFileSync(filePath, gptReply, 'utf8');

            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();

            await page.setContent(gptReply, { waitUntil: 'networkidle0' });

            const pdfOutputPath = path.join(__dirname, 'output.pdf');
            await page.pdf({
                path: pdfOutputPath,
                width: '80mm',
                height: '297mm',
                printBackground: true,
                scale: 1,
                margin: {
                    top: '10mm',
                    right: '0mm',
                    bottom: '10mm',
                    left: '0mm'
                }
            });

            await browser.close();
            console.log('PDF created successfully!');
            await client.sendText(message.from, gptReply)
                .then(result => {
                    console.log('Message sent:', result);
                })
                .catch(error => {
                    console.error('Error when sending message:', error);
                });

            await FunctionPrinter(pdfOutputPath);

        } catch (error) {
            console.error('Error communicating with OpenAI API:', error);
            await client.sendText(message.from, "Desculpe, estou tendo problemas para processar seu pedido agora.");
        }
    });
};
