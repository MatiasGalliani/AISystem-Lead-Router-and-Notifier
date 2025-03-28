const express = require('express');
const { google } = require('googleapis');
const app = express();
const cors = require('cors');
app.use(cors());

app.use(express.json());

const auth = new google.auth.GoogleAuth({
    keyFile: "credenciales.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

app.post('/guardar-en-sheets', async (req, res) => {
    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const spreadsheetID = '19y6rbzG52J4sgOlCS-y0DFinBTB6H6FiM4fbHPS87l4';
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

app.listen(3500, () => {
    console.log('Servidor corriendo en http://localhost:3500');
});
