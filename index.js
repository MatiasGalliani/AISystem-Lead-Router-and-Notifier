const express = require('express');
const { google } = require('googleapis');
const app = express();
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3500;

const auth = new google.auth.GoogleAuth({
    keyFile: "credenciales.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

app.post('/sheets', async (req, res) => {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const spreadsheetID = process.env.GOOGLE_SHEET_ID;
        const range = "'Manual Leads'!A1:D1";

        const { datos } = req.body;

        if (!Array.isArray(datos)) {
            return res.status(400).json({ error: 'Datos debe ser un array' });
        }

        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetID, //
            range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [datos],
            },
        });

        res.json({ message: 'Datos guardados con éxito' });

    } catch (error) {
        console.error('Error al guardar en Sheets:', error);
        res.status(500).json({ error: 'Ocurrió un error al guardar los datos' });
    }
});

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
      // Autenticación para Sheets y Gmail
      const auth = new google.auth.GoogleAuth({
        keyFile: "./credenciales.json",
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/gmail.send"
        ],
      });
      const authClient = await auth.getClient();
  
      // Guardar datos en Google Sheets
      const sheets = google.sheets({ version: "v4", auth: authClient });
      const sheetId = process.env.GOOGLE_SHEET_ID;
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "AIMedici.it!A1:J1",
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [
            [
              new Date().toLocaleString("it-IT"), // Fecha y hora
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
  
      // Crear el mensaje de correo
      const emailLines = [
        `From: "€ugenio by Creditplan" <it.creditplan@gmail.com>`,
        `To: ${"matiasgalliani00@gmail.com"}`,
        "Subject: Confirmación de envío de formulario",
        "",
        `Ciao ${Agente},`,
        "",
        "C'è un nuovo lead da AIMedici.it:",
        `- Nome: ${nome} ${cognome}`,
        `- Scopo della consulenza: ${financingScope}`,
        `- Importo Richiesto: ${importoRichiesto}`,
        `- Città: ${cittaResidenza}, Provincia: ${provinciaResidenza}`,
        `- Mail: ${mail}`,
        `- Telefono: ${telefono}`,
        "Grazie per la tua attenzione!",
        "Cordiali saluti,",
      ];
      const emailBody = emailLines.join("\r\n");
  
      // Codificar el mensaje en Base64 (URL-safe)
      const encodedMessage = Buffer.from(emailBody)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
  
      // Enviar el correo usando la API de Gmail
      const gmail = google.gmail({ version: "v1", auth: authClient });
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });
  
      res.status(200).json({ message: "Datos guardados y email enviado con éxito!" });
    } catch (error) {
      console.error("Error en el proceso:", error);
      res.status(500).json({ error: "Error en el proceso" });
    }
  });  

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto', PORT);
});
