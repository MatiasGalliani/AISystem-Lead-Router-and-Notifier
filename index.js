const express = require('express');
const { google } = require('googleapis');
const app = express();
const cors = require('cors');
const postmark = require("postmark");

require('dotenv').config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3500;

// Configuración de autenticación con Google Sheets
const auth = new google.auth.GoogleAuth({
    keyFile: "credenciales.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

// Endpoint raíz
app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

// Endpoint para guardar datos en Google Sheets (Manual Leads)
app.post('/sheets', async (req, res) => {
    try {
        // Autenticación y configuración de Google Sheets
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const spreadsheetID = process.env.GOOGLE_SHEET_ID;
        const range = "'Manual Leads'!A1:E1"; // Ajusta el rango según la cantidad de columnas
        const { datos, nome, cognome, email, telefono } = req.body;

        if (!Array.isArray(datos)) {
            return res.status(400).json({ error: 'Datos debe ser un array' });
        }

        // Guardar datos en Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetID,
            range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [datos],
            },
        });

        // Integración de Postmark: Enviar email de confirmación
        const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN);

        // Preparar el contenido del correo
        const textBody =
            `Nuovo Lead di Contatto Manuale
Ciao,
È arrivato un nuovo lead manuale con i seguenti dettagli:
Nome: ${nome || 'Non specificato'}
Cognome: ${cognome || 'Non specificato'}
Email: ${email || 'Non specificato'}
Telefono: ${telefono || 'Non specificato'}
Altri dati: ${datos.length > 0 ? datos.join(', ') : 'Nessun dato aggiuntivo'}
Saluti,
€ugenio IA`;

        const htmlBody = `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 20px; border-radius: 8px; }
      .header { background-color: #007bff; color: #fff; padding: 10px; text-align: center; border-radius: 6px 6px 0 0; }
      .content { padding: 20px; }
      .data-item { margin-bottom: 10px; }
      .label { font-weight: bold; }
      .footer { margin-top: 20px; font-size: 12px; text-align: center; color: #777; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>Nuovo Lead di Contatto Manuale</h2>
      </div>
      <div class="content">
        <p>Ciao,</p>
        <p>È arrivato un nuovo lead manuale con i seguenti dettagli:</p>
        <div class="data-item"><span class="label">Nome:</span> ${nome || 'Non specificato'}</div>
        <div class="data-item"><span class="label">Cognome:</span> ${cognome || 'Non specificato'}</div>
        <div class="data-item"><span class="label">Email:</span> ${email || 'Non specificato'}</div>
        <div class="data-item"><span class="label">Telefono:</span> ${telefono || 'Non specificato'}</div>
        <div class="data-item"><span class="label">Altri dati:</span> ${datos.length > 0 ? datos.join(', ') : 'Nessun dato aggiuntivo'}</div>
      </div>
      <div class="footer">
        <p>Saluti,<br>€ugenio IA</p>
      </div>
    </div>
  </body>
</html>`;

        const emailData = {
            "From": "€ugenio IA <it@creditplan.it>", // Asegúrate de que este remitente esté verificado en Postmark
            "To": "segreteria@creditplan.it",
            "Subject": "Nuovo Lead di Contatto Manuale",
            "TextBody": textBody,
            "HtmlBody": htmlBody
        };

        // Enviar el email
        await postmarkClient.sendEmail(emailData);

        // Responder al cliente
        res.json({ message: 'Datos guardados y email enviado con éxito' });
    } catch (error) {
        console.error('Error al guardar en Sheets o enviar email:', error);
        res.status(500).json({ error: 'Ocurrió un error al procesar la solicitud' });
    }
});

// Endpoint para "pensionato"
app.post("/pensionato", async (req, res) => {
    const {
        nome,
        cognome,
        mail,
        telefono,
        pensionAmount,
        pensioneNetta,
        entePensionistico,
        pensioneType,
        birthDate,
        province,
        privacyAccepted
    } = req.body;

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "./credenciales.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });

        const sheets = google.sheets({ version: "v4", auth });
        const sheetId = process.env.GOOGLE_SHEET_ID;

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Pensionati!A1:L1",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [
                    [
                        new Date().toLocaleString("it-IT"),
                        nome,
                        cognome,
                        mail,
                        telefono,
                        pensionAmount,
                        pensioneNetta,
                        entePensionistico,
                        pensioneType,
                        birthDate,
                        province,
                        privacyAccepted ? "SI" : "NO"
                    ]
                ]
            }
        });

        res.status(200).json({ message: "Dati salvati con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati" });
    }
});

// Endpoint para "dipendente"
app.post("/dipendente", async (req, res) => {
    const {
        nome,
        cognome,
        mail,
        telefono,
        amountRequested,
        netSalary,
        depType,
        secondarySelection,
        contractType,
        birthDate,
        province,
        privacyAccepted
    } = req.body;

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "./credenciales.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"]
        });

        const sheets = google.sheets({ version: "v4", auth });
        const sheetId = process.env.GOOGLE_SHEET_ID;

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Dipendenti!A1:M1",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [
                    [
                        new Date().toLocaleString("it-IT"),
                        nome,
                        cognome,
                        mail,
                        telefono,
                        amountRequested,
                        netSalary,
                        depType,
                        depType === "Privato" ? secondarySelection : "",
                        contractType,
                        birthDate,
                        province,
                        privacyAccepted ? "SI" : "NO"
                    ]
                ]
            }
        });

        res.status(200).json({ message: "Dati dipendente salvati con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati dipendente:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati dipendente" });
    }
});

// Endpoint para "aimediciform"
app.post("/aimediciform", async (req, res) => {
    const {
        financingScope,
        importoRichiesto,
        cittaResidenza,
        provinciaResidenza,
        nome,
        cognome,
        mail,
        telefono,
        privacyAccepted
    } = req.body;

    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: "./credenciales.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const sheets = google.sheets({ version: "v4", auth });
        const sheetId = process.env.GOOGLE_SHEET_ID;

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "AIMedici.it!A1:J1",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [
                    [
                        new Date().toLocaleString("it-IT"),
                        nome,
                        cognome,
                        financingScope,
                        importoRichiesto,
                        cittaResidenza,
                        provinciaResidenza,
                        mail,
                        telefono,
                        privacyAccepted ? "SI" : "NO",
                    ],
                ],
            },
        });

        res.status(200).json({ message: "Dati salvati con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati" });
    }
});

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto', PORT);
});