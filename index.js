const express = require('express');
const { google } = require('googleapis');
const { Resend } = require("resend");
const app = express();
const cors = require('cors');
require('dotenv').config();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3500;

// Inicializar Resend con la API Key
const resend = new Resend(process.env.RESEND_API_KEY);

async function getGoogleSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: "./credenciales.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: "v4", auth: authClient });
}

// Endpoint raíz
app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});

// Endpoint para guardar datos en Google Sheets (Manual Leads)
app.post('/manuale_aiquinto', async (req, res) => {
    try {
        // Autenticación y configuración de Google Sheets
        const sheets = await getGoogleSheetsClient();
        const spreadsheetID = process.env.GOOGLE_SHEET_ID;
        const range = "'Manual Leads'!A1:E1"; // Ajusta el rango según la cantidad de columnas

        // Suponemos que 'datos' es un array con [nome, cognome, email, telefono, ...otros]
        const datos = req.body.datos;

        if (!Array.isArray(datos)) {
            return res.status(400).json({ error: 'Datos debe ser un array' });
        }

        // Extraer campos desde datos o desde propiedades separadas en req.body
        const nome = req.body.nome || (datos.length >= 1 ? datos[0] : 'Non specificato');
        const cognome = req.body.cognome || (datos.length >= 2 ? datos[1] : 'Non specificato');
        const emailField = req.body.email || (datos.length >= 3 ? datos[2] : 'Non specificato');
        const telefono = req.body.telefono || (datos.length >= 4 ? datos[3] : 'Non specificato');

        // Guardar datos en Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetID,
            range,
            valueInputOption: 'RAW',
            requestBody: {
                values: [datos],
            },
        });

        // Preparar el contenido del correo
        const textBody =
            `Nuovo Lead di Contatto Manuale
Ciao,
È arrivato un nuovo lead manuale su AIQuinto.it con i seguenti dettagli:
Nome: ${nome}
Cognome: ${cognome}
Email: ${emailField}
Telefono: ${telefono}
Saluti,
€ugenio IA`;

        const htmlBody = `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 20px auto; background: #fff; padding: 20px; border-radius: 8px; }
      .header { background-color: #007bff; color: #fff; padding: 20px; text-align: center; border-radius: 6px 6px 0 0; }
      .logo { max-width: 150px; height: auto; margin-bottom: 10px; }
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
        <div class="data-item"><span class="label">Nome:</span> ${nome}</div>
        <div class="data-item"><span class="label">Cognome:</span> ${cognome}</div>
        <div class="data-item"><span class="label">Email:</span> ${emailField}</div>
        <div class="data-item"><span class="label">Telefono:</span> ${telefono}</div>
      </div>
      <div class="footer">
        <p>Saluti</p>
        <img class="logo" src="https://i.imgur.com/Wzz0KLR.png" alt="€ugenio IA" style="width: 150px; height: auto;" />
      </div>
    </div>
  </body>
</html>`;

        const emailData = {
            from: "€ugenio IA <eugenioia@resend.dev>", // Usamos la dirección temporal hasta recuperar el dominio
            to: "it@creditplan.it",
            subject: "Nuovo Lead di Contatto Manuale",
            text: textBody,
            html: htmlBody
        };

        // Enviar el correo usando Resend
        await resend.emails.send(emailData);

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
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Guardar datos en Google Sheets
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

        // Preparar email de notificación
        const subject = "Nuovo Lead Pensionato";
        const textBody =
            `Nuovo Lead Pensionato\n\n` +
            `Nome: ${nome}\n` +
            `Cognome: ${cognome}\n` +
            `Email: ${mail}\n` +
            `Telefono: ${telefono}\n` +
            `Importo Pensione: ${pensionAmount}\n` +
            `Pensione Netta: ${pensioneNetta}\n` +
            `Ente Pensionistico: ${entePensionistico}\n` +
            `Tipo di Pensione: ${pensioneType}\n` +
            `Data di Nascita: ${birthDate}\n` +
            `Provincia: ${province}\n` +
            `Privacy Accettata: ${privacyAccepted ? "SI" : "NO"}\n`;

        const htmlBody = `
<html>
    <body>
        <h3>Nuovo Lead Pensionato</h3>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Cognome:</strong> ${cognome}</p>
        <p><strong>Email:</strong> ${mail}</p>
        <p><strong>Telefono:</strong> ${telefono}</p>
        <p><strong>Importo Pensione:</strong> ${pensionAmount}</p>
        <p><strong>Pensione Netta:</strong> ${pensioneNetta}</p>
        <p><strong>Ente Pensionistico:</strong> ${entePensionistico}</p>
        <p><strong>Tipo di Pensione:</strong> ${pensioneType}</p>
        <p><strong>Data di Nascita:</strong> ${birthDate}</p>
        <p><strong>Provincia:</strong> ${province}</p>
        <p><strong>Privacy Accettata:</strong> ${privacyAccepted ? "SI" : "NO"}</p>
    </body>
</html>`;

        const emailData = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: "andreafriggieri@creditplan.it",
            subject,
            text: textBody,
            html: htmlBody
        };

        await resend.emails.send(emailData);

        res.status(200).json({ message: "Dati salvati e email inviata con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati o nell'invio della email" });
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
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Guardar datos en Google Sheets
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

        // Preparar email de notificación para lead dipendente
        const subject = "Nuovo Lead Dipendente";
        const textBody =
            `Nuovo Lead Dipendente\n\n` +
            `Nome: ${nome}\n` +
            `Cognome: ${cognome}\n` +
            `Email: ${mail}\n` +
            `Telefono: ${telefono}\n` +
            `Importo Richiesto: ${amountRequested}\n` +
            `Salario Netto: ${netSalary}\n` +
            `Tipo di Dipendente: ${depType}\n` +
            `Selezione Secondaria: ${depType === "Privato" ? secondarySelection : "N/A"}\n` +
            `Tipo di Contratto: ${contractType}\n` +
            `Data di Nascita: ${birthDate}\n` +
            `Provincia: ${province}\n` +
            `Privacy Accettata: ${privacyAccepted ? "SI" : "NO"}\n`;

        const htmlBody = `
<html>
    <body>
        <h3>Nuovo Lead Dipendente</h3>
        <p><strong>Nome:</strong> ${nome}</p>
        <p><strong>Cognome:</strong> ${cognome}</p>
        <p><strong>Email:</strong> ${mail}</p>
        <p><strong>Telefono:</strong> ${telefono}</p>
        <p><strong>Importo Richiesto:</strong> ${amountRequested}</p>
        <p><strong>Salario Netto:</strong> ${netSalary}</p>
        <p><strong>Tipo di Dipendente:</strong> ${depType}</p>
        <p><strong>Selezione Secondaria:</strong> ${depType === "Privato" ? secondarySelection : "N/A"}</p>
        <p><strong>Tipo di Contratto:</strong> ${contractType}</p>
        <p><strong>Data di Nascita:</strong> ${birthDate}</p>
        <p><strong>Provincia:</strong> ${province}</p>
        <p><strong>Privacy Accettata:</strong> ${privacyAccepted ? "SI" : "NO"}</p>
    </body>
</html>`;

        const emailData = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: "andreafriggieri@creditplan.it",
            subject,
            text: textBody,
            html: htmlBody
        };

        await resend.emails.send(emailData);

        res.status(200).json({ message: "Dati dipendente salvati e email inviata con successo!" });
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
        const sheets = await getGoogleSheetsClient();
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

        // Preparar email de notificación para lead medico
        const subject = "Nuovo Lead Medico";
        const textBody = `
Nuovo Lead Medico

Nome: ${nome}
Cognome: ${cognome}
Email: ${mail}
Telefono: ${telefono}
Scopo del finanziamento: ${financingScope}
Importo richiesto: ${importoRichiesto}
Città di residenza: ${cittaResidenza}
Provincia: ${provinciaResidenza}
Privacy accettata: ${privacyAccepted ? "SI" : "NO"}
`;
        const htmlBody = `
<html>
  <body>
    <h3>Nuovo Lead Medico</h3>
    <p><strong>Nome:</strong> ${nome}</p>
    <p><strong>Cognome:</strong> ${cognome}</p>
    <p><strong>Email:</strong> ${mail}</p>
    <p><strong>Telefono:</strong> ${telefono}</p>
    <p><strong>Scopo del finanziamento:</strong> ${financingScope}</p>
    <p><strong>Importo richiesto:</strong> ${importoRichiesto}</p>
    <p><strong>Città di residenza:</strong> ${cittaResidenza}</p>
    <p><strong>Provincia:</strong> ${provinciaResidenza}</p>
    <p><strong>Privacy accettata:</strong> ${privacyAccepted ? "SI" : "NO"}</p>
  </body>
</html>
`;
        const emailData = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: "nicofalcinelli@creditplan.it",
            subject,
            text: textBody,
            html: htmlBody
        };

        await resend.emails.send(emailData);

        res.status(200).json({ message: "Dati salvati e email inviata con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati o dell'email:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati o dell'email" });
    }
});

// Endpoint para "aifidi"
app.post("/aifidi", async (req, res) => {
    const {
        nome,
        cognome,
        financingScope,
        importoRichiesto,
        nomeAzienda,
        cittaSedeLegale,
        cittaSedeOperativa,
        mail,
        telefono,
        privacyAccepted
    } = req.body;

    try {
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "AIFidi.it!A1:K1",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [
                    [
                        new Date().toLocaleString("it-IT"),
                        nome,
                        cognome,
                        mail,
                        telefono,
                        financingScope,
                        nomeAzienda,
                        cittaSedeLegale,
                        cittaSedeOperativa,
                        importoRichiesto,
                        privacyAccepted ? "SI" : "NO"
                    ],
                ],
            },
        });

        // Preparar email de notificación para lead AIFidi
        const subject = "Nuovo Lead AIFidi";
        const textBody = `
Nuovo Lead AIFidi

Nome: ${nome}
Cognome: ${cognome}
Email: ${mail}
Telefono: ${telefono}
Scopo del finanziamento: ${financingScope}
Importo richiesto: ${importoRichiesto}
Nome azienda: ${nomeAzienda}
Città sede legale: ${cittaSedeLegale}
Città sede operativa: ${cittaSedeOperativa}
Privacy accettata: ${privacyAccepted ? "SI" : "NO"}
`;
        const htmlBody = `
<html>
  <body>
    <h3>Nuovo Lead AIFidi</h3>
    <p><strong>Nome:</strong> ${nome}</p>
    <p><strong>Cognome:</strong> ${cognome}</p>
    <p><strong>Email:</strong> ${mail}</p>
    <p><strong>Telefono:</strong> ${telefono}</p>
    <p><strong>Scopo del finanziamento:</strong> ${financingScope}</p>
    <p><strong>Importo richiesto:</strong> ${importoRichiesto}</p>
    <p><strong>Nome azienda:</strong> ${nomeAzienda}</p>
    <p><strong>Città sede legale:</strong> ${cittaSedeLegale}</p>
    <p><strong>Città sede operativa:</strong> ${cittaSedeOperativa}</p>
    <p><strong>Privacy accettata:</strong> ${privacyAccepted ? "SI" : "NO"}</p>
  </body>
</html>
`;
        const emailData = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: "thomasiezzi@creditplan.it",
            subject,
            text: textBody,
            html: htmlBody
        };

        await resend.emails.send(emailData);

        res.status(200).json({ message: "Dati salvati e email inviata con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati o dell'email:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati o dell'email" });
    }
});

app.listen(PORT, () => {
    console.log('Servidor corriendo en el puerto', PORT);
});
