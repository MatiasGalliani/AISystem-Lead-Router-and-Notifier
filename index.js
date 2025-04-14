const express = require('express');
const { google } = require('googleapis');
const { Resend } = require("resend");
const cors = require('cors');
require('dotenv').config();
const { assegnaAgenteRoundRobin } = require('./agenti');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT = process.env.PORT || 3500;

app.use(cors());
app.use(express.json());

async function getGoogleSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: "./credenciales.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: "v4", auth: authClient });
}

app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

app.post('/manuale_aiquinto', async (req, res) => {
    try {
        const sheets = await getGoogleSheetsClient();
        const spreadsheetID = process.env.GOOGLE_SHEET_ID;
        const range = "'Manual Leads'!A1:E1";
        const datos = req.body.datos;

        if (!Array.isArray(datos)) return res.status(400).json({ error: 'Datos debe ser un array' });

        const nome = req.body.nome || datos[0] || 'Non specificato';
        const cognome = req.body.cognome || datos[1] || 'Non specificato';
        const emailField = req.body.email || datos[2] || 'Non specificato';
        const telefono = req.body.telefono || datos[3] || 'Non specificato';

        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetID,
            range,
            valueInputOption: 'RAW',
            requestBody: { values: [datos] },
        });

        const agente = await assegnaAgenteRoundRobin();

        const textBody = `Nuovo Lead per te\nNome: ${nome}\nCognome: ${cognome}\nEmail: ${emailField}\nTelefono: ${telefono}`;
        const htmlBody = `
        <html><body>
        <h3>Nuovo Lead</h3>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Cognome:</strong> ${cognome}</p>
        <p><strong>Email:</strong> ${emailField}</p>
        <p><strong>Telefono:</strong> ${telefono}</p>
        </body></html>`;

        await resend.emails.send({
            from: "Eugenio IA <eugenioia@resend.dev>",
            to: agente.email,
            subject: "Nuovo Lead Assegnato",
            text: textBody,
            html: htmlBody,
        });

        const clientText = `Grazie per averci contattato! Il tuo consulente è ${agente.nome}. Puoi prenotare una videochiamata qui: ${agente.calendly}`;
        const clientHtml = `
        <html><body>
        <h3>Grazie per averci contattato!</h3>
        <p>Il tuo consulente è <strong>${agente.nome}</strong>.</p>
        <p>Puoi prenotare una videochiamata cliccando qui: <a href="${agente.calendly}">${agente.calendly}</a></p>
        </body></html>`;

        await resend.emails.send({
            from: "Eugenio IA <eugenioia@resend.dev>",
            to: emailField,
            subject: "Grazie per la tua richiesta",
            text: clientText,
            html: clientHtml,
        });

        res.json({ message: 'Lead salvato e email inviate con successo' });

    } catch (error) {
        console.error('Errore:', error);
        res.status(500).json({ error: 'Errore durante il processo del lead' });
    }
});

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto', PORT);
});