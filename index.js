const express = require('express');
const { google } = require('googleapis');
const app = express();
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const auth = new google.auth.GoogleAuth({
    keyFile: "credenciales.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
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

app.listen(3500, () => {
    console.log('Servidor corriendo en http://localhost:3500');
});
