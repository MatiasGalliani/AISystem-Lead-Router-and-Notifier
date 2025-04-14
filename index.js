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

// Extraer los destinatarios desde .env y convertirlos en un array
const manualRecipients = process.env.MANUAL_RECIPIENTS
    ? process.env.MANUAL_RECIPIENTS.split(',').map(email => email.trim())
    : [];

if (manualRecipients.length === 0) {
    console.error("No hay destinatarios configurados en MANUAL_RECIPIENTS");
    process.exit(1);
}

// Parsear el mapeo de cada agente a su Google Sheet privado desde la variable AGENT_SHEETS
const agentSheetMapping = {};
if (process.env.AGENT_SHEETS) {
    process.env.AGENT_SHEETS.split(',').forEach(pair => {
        const [email, sheetId] = pair.split(':').map(s => s.trim());
        if (email && sheetId) {
            agentSheetMapping[email] = sheetId;
        }
    });
}

// Verificar que cada agente tenga configurado su sheet
manualRecipients.forEach(email => {
    if (!agentSheetMapping[email]) {
        console.error(`No se ha configurado una hoja para el agente ${email}`);
    }
});

// Índice global para el mecanismo de round-robin
let roundRobinIndex = 0;

const agentInfoMapping = {};
if (process.env.AGENT_INFO) {
    process.env.AGENT_INFO.split(',').forEach(pair => {
        // Suponemos que cada par está separado por dos puntos (:)
        const parts = pair.split(':').map(s => s.trim());
        if (parts.length === 4) {
            const [email, name, phone, calendly] = parts;
            agentInfoMapping[email] = { name, phone, calendly };
        } else {
            console.error("Formato incorrecto en AGENT_INFO para:", pair);
        }
    });
} else {
    console.error("AGENT_INFO no está definido en el .env");
}

app.post('/manuale_aiquinto', async (req, res) => {
    console.log("=== Iniciando procesamiento de /manuale_aiquinto ===");
    console.log("Datos recibidos:", req.body);

    try {
        // Autenticación y configuración de Google Sheets
        const sheets = await getGoogleSheetsClient();
        console.log("Cliente de Google Sheets inicializado correctamente.");

        // Seleccionar el destinatario actual usando round-robin
        const recipient = manualRecipients[roundRobinIndex];
        console.log("Destinatario seleccionado:", recipient);

        // Actualizar el índice para el próximo correo
        roundRobinIndex = (roundRobinIndex + 1) % manualRecipients.length;
        console.log("Nuevo índice round-robin:", roundRobinIndex);

        // Obtener el ID del Google Sheet privado para este agente
        const agentSheetId = agentSheetMapping[recipient];
        if (!agentSheetId) {
            console.error(`No se ha configurado una hoja para el agente ${recipient}`);
            return res.status(500).json({ error: 'Configuración de hoja privada faltante para el agente' });
        }

        // Definir el rango donde se guardarán los datos en la hoja privada
        const range = "Leads!A1:E1"; // Ajusta el rango según la estructura de la hoja

        // Suponemos que 'datos' es un array con [nome, cognome, email, telefono, ...otros]
        const datos = req.body.datos;
        if (!Array.isArray(datos)) {
            console.error("Error: 'datos' no es un array.");
            return res.status(400).json({ error: 'Datos debe ser un array' });
        }

        // Extraer campos desde datos o desde propiedades separadas en req.body
        const nome = req.body.nome || (datos.length >= 1 ? datos[0] : 'Non specificato');
        const cognome = req.body.cognome || (datos.length >= 2 ? datos[1] : 'Non specificato');
        const emailField = req.body.email || (datos.length >= 3 ? datos[2] : 'Non specificato');
        const telefono = req.body.telefono || (datos.length >= 4 ? datos[3] : 'Non specificato');

        // Guardar datos en el Google Sheet privado del agente
        console.log(`Guardando datos en la hoja del agente ${recipient} (Sheet ID: ${agentSheetId})...`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: agentSheetId,
            range,
            valueInputOption: 'RAW',
            requestBody: { values: [datos] },
        });
        console.log("Datos guardados correctamente en la hoja del agente.");

        // Preparar el contenido del correo para el agente (sin cambios)
        const textBodyAgent =
            `Nuovo Lead di Contatto Manuale
Ciao,
È arrivato un nuovo lead manuale su AIQuinto.it con i seguenti detalles:
Nome: ${nome}
Cognome: ${cognome}
Email: ${emailField}
Telefono: ${telefono}
Saluti,
€ugenio IA`;

        const htmlBodyAgent = `
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
        <p>È arrivato un nuovo lead manuale con i seguenti detalles:</p>
        <div class="data-item"><span class="label">Nome:</span> ${nome}</div>
        <div class="data-item"><span class="label">Cognome:</span> ${cognome}</div>
        <div class="data-item"><span class="label">Email:</span> ${emailField}</div>
        <div class="data-item"><span class="label">Telefono:</span> ${telefono}</div>
      </div>
      <div class="footer">
        <p>Saluti</p>
        <img class="logo" src="https://i.imgur.com/Wzz0KLR.png" alt="€ugenio IA" style="width: 150px;" />
      </div>
    </div>
  </body>
</html>`;

        const emailDataAgent = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: recipient,
            subject: "Nuovo Lead di Contatto Manuale",
            text: textBodyAgent,
            html: htmlBodyAgent
        };

        console.log("Enviando correo al agente...");
        await resend.emails.send(emailDataAgent);
        console.log("Correo enviado con éxito al agente:", recipient);

        // Preparar el contenido del correo para el cliente utilizando la información del agente
        const agentInfo = agentInfoMapping[recipient];
        if (!agentInfo) {
            console.error(`No se encontró información para el agente ${recipient}`);
        }
        const textBodyClient =
            `Hola,
Gracias por enviar tu información. Tu agente asignado es ${agentInfo ? agentInfo.name : 'nuestro agente'}.
${agentInfo ? "Puedes contactarlo al " + agentInfo.phone : ""}
Si lo deseas, también puedes agendar una llamada: ${agentInfo && agentInfo.calendly ? agentInfo.calendly : ""}
Saludos,
AIQuinto`;

        const htmlBodyClient = `
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f7f7f7; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); overflow: hidden; }
      .header { background-color: #007bff; color: #ffffff; padding: 20px; text-align: center; }
      .content { padding: 20px; }
      .button { display: inline-block; padding: 10px 20px; margin-top: 20px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 5px; }
      .footer { text-align: center; padding: 10px; font-size: 12px; color: #888888; background-color: #f7f7f7; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h2>¡Gracias por contactarnos!</h2>
      </div>
      <div class="content">
        <p>Tu agente asignado es <strong>${agentInfo ? agentInfo.name : 'nuestro agente'}</strong>.</p>
        <p>${agentInfo ? "Teléfono: " + agentInfo.phone : ""}</p>
        <p>Si deseas que te llamemos o agendar una llamada, haz clic en el siguiente botón:</p>
        <p><a href="${agentInfo && agentInfo.calendly ? agentInfo.calendly : '#'}" class="button">Agendar llamada</a></p>
        <p>Estaremos en contacto para ayudarte.</p>
      </div>
      <div class="footer">
        <p>Saludos,<br>El equipo de AIQuinto</p>
      </div>
    </div>
  </body>
</html>`;

        const emailDataClient = {
            from: "AIQuinto <eugenioia@resend.dev>", // Usa un remitente verificado en producción
            to: emailField,  // Correo del cliente
            subject: "Conoce a tu agente asignado en AIQuinto",
            text: textBodyClient,
            html: htmlBodyClient
        };

        console.log("Enviando correo al cliente...");
        await resend.emails.send(emailDataClient);
        console.log("Correo enviado con éxito al cliente:", emailField);

        res.json({ message: 'Datos guardados y correos enviados con éxito' });
    } catch (error) {
        console.error('Error al procesar la solicitud:', error);
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
