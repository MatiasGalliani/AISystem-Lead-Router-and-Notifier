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
    // Extraemos los datos enviados desde el formulario
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
        // Autenticación con Google Sheets
        const auth = new google.auth.GoogleAuth({
            keyFile: "./credenciales.json",
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const sheets = google.sheets({ version: "v4", auth });
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Se asume que la hoja se llama "AiMedici.it" y que usas 10 columnas:
        // Columna A: Fecha y hora de envío
        // Columna B: financingScope
        // Columna C: importoRichiesto
        // Columna D: cittaResidenza
        // Columna E: provinciaResidenza
        // Columna F: nome
        // Columna G: cognome
        // Columna H: mail
        // Columna I: telefono
        // Columna J: privacyAccepted ("SI" o "NO")
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "AiMedici.it!A1:J1",
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

        res.status(200).json({ message: "Dati salvati con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati" });
    }
});

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto', PORT);
});
