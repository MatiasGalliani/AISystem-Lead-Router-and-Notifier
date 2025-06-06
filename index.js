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
        // Ahora usamos '|' como delimitador
        const parts = pair.split('|').map(s => s.trim());
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

const aimediciAgentInfoMapping = {};
if (process.env.AIMEDICI_AGENT_INFO) {
    process.env.AIMEDICI_AGENT_INFO.split(',').forEach(pair => {
        const parts = pair.split(':').map(s => s.trim());
        if (parts.length === 4) {
            const [email, name, phone, calendly] = parts;
            aimediciAgentInfoMapping[email] = { name, phone, calendly };
        } else {
            console.error("Formato incorrecto en AIMEDICI_AGENT_INFO para:", pair);
        }
    });
} else {
    console.error("AIMEDICI_AGENT_INFO no está definido en el .env");
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
        const range = "Manuale!A1:E1"; // Ajusta el rango según la estructura de la hoja

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
        // Usar las variables ya definidas para formar el nombre del cliente
        const clientName = `${nome} ${cognome}`.trim() || 'Cliente';

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
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conosci il tuo agente in Creditplan</title>
</head>
<body style="background-color: #eff6ff; margin: 0; padding: 0;">
  <div style="max-width: 32rem; margin: 0 auto; background: #ffffff; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
    <!-- Header: imagen con URL absoluto -->
    <div>
      <img src="https://i.imgur.com/1avwDd5.png" alt="Intestazione della Mail" style="width: 100%; display: block;">
    </div>
    <!-- Título -->
    <div style="text-align: center; padding: 1rem 0;">
      <span style="font-size: 2.25rem; font-weight: bold; color: #1e3a8a;">Grazie!</span>
    </div>
    <!-- Contenido Principal -->
    <div style="padding: 1.5rem; color: #4a5568;">
      <!-- Mensaje introductorio -->
      <p style="margin-bottom: 1rem;">Ciao <strong>${clientName},</strong></p>
      <p style="margin-bottom: 1rem;">
        <strong>Prima di tutto,</strong> ti ringraziamo per aver scelto Creditplan per le tue esigenze finanziarie. Siamo lieti di poterti supportare e ci impegniamo a fornirti l’assistenza più adeguata e personalizzata.
      </p>
      <p style="margin-bottom: 1rem;">
        Il nostro sistema ha processato la tua richiesta e, in base alla nostra organizzazione, <strong>ti è stato assegnato un agente dedicato</strong> che si occuperà di fornirti tutte le informazioni necessarie e guidarti nel percorso.
      </p>
      <!-- Información del agente -->
      <p style="margin-bottom: 1rem;">
        Il tuo agente assegnato è <strong>${agentInfo ? agentInfo.name : 'il nostro agente'}</strong>.
      </p>
      <p style="margin-bottom: 1rem;">
        Puoi contattarlo direttamente al numero <strong>${agentInfo ? agentInfo.phone : ''}</strong> oppure, se preferisci, fissare una chiamata utilizzando il link qui sotto.
      </p>
      <div style="text-align: center;">
        <a href="${agentInfo && agentInfo.calendly ? agentInfo.calendly : '#'}" 
           style="display: inline-block; padding: 0.5rem 1.5rem; background-color: #1e3a8a; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 0.75rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          Fissa una chiamata
        </a>
      </div>
      <p style="margin-top: 1.5rem;">
        Siamo certi che il nostro team saprà offrirti la migliore consulenza e supporto. Rimaniamo a tua completa disposizione per qualsiasi ulteriore informazione.
      </p>
      <p style="margin-top: 0.5rem;">
        Cordiali saluti,<br>
        Il team di Creditplan
      </p>
    </div>
    <!-- Pie de Página -->
    <div style="background-color: #eff6ff; padding: 1rem; text-align: center; font-size: 0.875rem; color: #718096; border-top: 1px solid #e2e8f0;">
      &copy; 2025 Creditplan Società di Mediazione Creditizia. Tutti i diritti riservati.<br>
      Via Giacomo Tosi 3, Monza, MB (20900)
    </div>
  </div>
</body>
</html>
`;

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
        // Autenticación y configuración de Google Sheets
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Obtener la fecha y hora actuales
        const currentDate = new Date().toLocaleString("it-IT");

        // Guardar datos en Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Pensionati!A1:L1", // Asegúrate de que el rango sea correcto
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [
                    [
                        currentDate, // Aquí estamos añadiendo la fecha en la primera columna
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

        // Guardar datos en el Google Sheet privado del agente
        console.log(`Guardando datos en la hoja del agente ${recipient} (Sheet ID: ${agentSheetId})...`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: agentSheetId,
            range: "Pensionati!A1:L1", // Ajusta el rango según la estructura de la hoja
            valueInputOption: 'RAW',
            requestBody: { values: [[currentDate, nome, cognome, mail, telefono, pensionAmount, pensioneNetta, entePensionistico, pensioneType, birthDate, province, privacyAccepted ? "SI" : "NO"]] },
        });
        console.log("Datos guardados correctamente en la hoja del agente.");

        // Preparar email de notificación para el agente
        const textBodyAgent =
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
        <h2>Nuovo Lead Pensionato</h2>
      </div>
      <div class="content">
        <p>Ciao,</p>
        <p>È arrivato un nuovo lead pensionato con i seguenti dettagli:</p>
        <div class="data-item"><span class="label">Nome:</span> ${nome}</div>
        <div class="data-item"><span class="label">Cognome:</span> ${cognome}</div>
        <div class="data-item"><span class="label">Email:</span> ${mail}</div>
        <div class="data-item"><span class="label">Telefono:</span> ${telefono}</div>
        <div class="data-item"><span class="label">Importo Pensione:</span> ${pensionAmount}</div>
        <div class="data-item"><span class="label">Pensione Netta:</span> ${pensioneNetta}</div>
        <div class="data-item"><span class="label">Ente Pensionistico:</span> ${entePensionistico}</div>
        <div class="data-item"><span class="label">Tipo di Pensione:</span> ${pensioneType}</div>
        <div class="data-item"><span class="label">Data di Nascita:</span> ${birthDate}</div>
        <div class="data-item"><span class="label">Provincia:</span> ${province}</div>
        <div class="data-item"><span class="label">Privacy Accettata:</span> ${privacyAccepted ? "SI" : "NO"}</div>
      </div>
      <div class="footer">
        <p>Saluti</p>
        <img class="logo" src="https://i.imgur.com/Wzz0KLR.png" alt="€ugenio IA" style="width: 150px;" />
      </div>
    </div>
  </body>
</html>
`;

        const emailDataAgent = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: recipient, // El agente asignado
            subject: "Nuovo Lead Pensionato",
            text: textBodyAgent,
            html: htmlBodyAgent
        };

        console.log("Enviando correo al agente...");
        await resend.emails.send(emailDataAgent);
        console.log("Correo enviado con éxito al agente.");

        // Preparar email para el cliente utilizando la información del agente asignado
        const agentInfo = agentInfoMapping[recipient]; // Información del agente asignado
        const clientName = `${nome} ${cognome}`;

        const textBodyClient =
            `Hola ${clientName},\n\nGracias por enviarnos tu información. El agente asignado para ayudarte es ${agentInfo ? agentInfo.name : 'nuestro agente'}.\n` +
            `${agentInfo ? "Puedes contactarlo al " + agentInfo.phone : ""}\n` +
            `Si lo deseas, también puedes agendar una llamada usando el siguiente enlace: ${agentInfo && agentInfo.calendly ? agentInfo.calendly : ""}\n\nSaludos,\nAIQuinto`;

        const htmlBodyClient = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conosci il tuo agente in Creditplan</title>
</head>
<body style="background-color: #eff6ff; margin: 0; padding: 0;">
  <div style="max-width: 32rem; margin: 0 auto; background: #ffffff; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
    <div>
      <img src="https://i.imgur.com/1avwDd5.png" alt="Intestazione della Mail" style="width: 100%; display: block;">
    </div>
    <div style="text-align: center; padding: 1rem 0;">
      <span style="font-size: 2.25rem; font-weight: bold; color: #1e3a8a;">Grazie!</span>
    </div>
    <div style="padding: 1.5rem; color: #4a5568;">
      <p style="margin-bottom: 1rem;">Ciao <strong>${clientName},</strong></p>
      <p style="margin-bottom: 1rem;">
        Ti ringraziamo per aver scelto Creditplan per le tue esigenze pensionistiche. Abbiamo ricevuto la tua richiesta per il supporto relativo alla tua pensione e siamo qui per aiutarti.
      </p>
      <p style="margin-bottom: 1rem;">
        Il nostro sistema ha processato la tua richiesta e ti abbiamo assegnato un agente specializzato che si occuperà di fornirti tutte le informazioni necessarie.
      </p>
      <p style="margin-bottom: 1rem;">
        Il tuo agente assegnato è <strong>${agentInfo ? agentInfo.name : 'il nostro specialista'}</strong>.
      </p>
      <p style="margin-bottom: 1rem;">
        Puoi contattarlo direttamente al numero <strong>${agentInfo ? agentInfo.phone : ''}</strong> oppure fissare una chiamata utilizzando il link qui sotto:
      </p>
      <div style="text-align: center;">
        <a href="${agentInfo && agentInfo.calendly ? agentInfo.calendly : '#'}" 
           style="display: inline-block; padding: 0.5rem 1.5rem; background-color: #1e3a8a; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 0.75rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          Fissa una chiamata
        </a>
      </div>
      <p style="margin-top: 1.5rem;">
        Siamo certi che il nostro team saprà offrirti la migliore consulenza per le tue necessità pensionistiche.
      </p>
      <p style="margin-top: 0.5rem;">
        Cordiali saluti,<br>
        Il team di Creditplan
      </p>
    </div>
    <div style="background-color: #eff6ff; padding: 1rem; text-align: center; font-size: 0.875rem; color: #718096; border-top: 1px solid #e2e8f0;">
      &copy; 2025 Creditplan Società di Mediazione Creditizia. Tutti i diritti riservati.<br>
      Via Giacomo Tosi 3, Monza, MB (20900)
    </div>
  </div>
</body>
</html>
`;

        const emailDataClient = {
            from: "AIQuinto <eugenioia@resend.dev>",
            to: mail,
            subject: "Conosci il tuo agente per il settore pensioni - Creditplan",
            text: textBodyClient,
            html: htmlBodyClient
        };

        console.log("Enviando correo al cliente...");
        await resend.emails.send(emailDataClient);
        console.log("Correo enviado con éxito al cliente.");

        res.status(200).json({ message: "Dati salvati e email inviata con successo!" });
    } catch (error) {
        console.error("Errore nell'invio dei dati o dell'email:", error);
        res.status(500).json({ error: "Errore nell'invio dei dati o dell'email" });
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
        privacyAccepted,
        employmentDate,
        numEmployees,
    } = req.body;

    try {
        // Autenticación y configuración de Google Sheets
        const sheets = await getGoogleSheetsClient();
        const sheetId = process.env.GOOGLE_SHEET_ID;

        // Obtener la fecha y hora actuales
        const currentDate = new Date().toLocaleString("it-IT");

        // Guardar datos en Google Sheets
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: "Dipendenti!A1:O1",
            valueInputOption: "USER_ENTERED",
            resource: {
                values: [
                    [
                        currentDate, // Agregar la fecha en la primera columna (A)
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
                        employmentDate,
                        numEmployees,
                        privacyAccepted ? "SI" : "NO"
                    ]
                ]
            }
        });

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

        // Guardar datos en el Google Sheet privado del agente
        console.log(`Guardando datos en la hoja del agente ${recipient} (Sheet ID: ${agentSheetId})...`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: agentSheetId,
            range: "Dipendenti!A1:M1", // Ajustar según la estructura de la hoja
            valueInputOption: 'RAW',
            requestBody: { values: [[currentDate, nome, cognome, mail, telefono, amountRequested, netSalary, depType, depType === "Privato" ? secondarySelection : "", contractType, birthDate, province, privacyAccepted ? "SI" : "NO"]] },
        });
        console.log("Datos guardados correctamente en la hoja del agente.");

        // Preparar el contenido del correo para el agente
        const textBodyAgent =
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
            `Data di Assunzione: ${employmentDate}\n` +
            `Numero di Dipendenti: ${numEmployees}\n` +
            `Privacy Accettata: ${privacyAccepted ? "SI" : "NO"}\n`;

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
        <h2>Nuovo Lead Dipendente</h2>
      </div>
      <div class="content">
        <p>Ciao,</p>
        <p>È arrivato un nuovo lead dipendente con i seguenti dettagli:</p>
        <div class="data-item"><span class="label">Nome:</span> ${nome}</div>
        <div class="data-item"><span class="label">Cognome:</span> ${cognome}</div>
        <div class="data-item"><span class="label">Email:</span> ${mail}</div>
        <div class="data-item"><span class="label">Telefono:</span> ${telefono}</div>
        <div class="data-item"><span class="label">Importo Richiesto:</span> ${amountRequested}</div>
        <div class="data-item"><span class="label">Salario Netto:</span> ${netSalary}</div>
        <div class="data-item"><span class="label">Tipo di Dipendente:</span> ${depType}</div>
        <div class="data-item"><span class="label">Selezione Secondaria:</span> ${depType === "Privato" ? secondarySelection : "N/A"}</div>
        <div class="data-item"><span class="label">Tipo di Contratto:</span> ${contractType}</div>
        <div class="data-item"><span class="label">Data di Nascita:</span> ${birthDate}</div>
        <div class="data-item"><span class="label">Provincia:</span> ${province}</div>
        <div class="data-item"><span class="label">Data di Assunzione:</span> ${employmentDate}</div>
        <div class="data-item"><span class="label">Numero di Dipendenti:</span> ${numEmployees}</div>
        <div class="data-item"><span class="label">Privacy Accettata:</span> ${privacyAccepted ? "SI" : "NO"}</div>
      </div>
      <div class="footer">
        <p>Saluti</p>
        <img class="logo" src="https://i.imgur.com/Wzz0KLR.png" alt="€ugenio IA" style="width: 150px;" />
      </div>
    </div>
  </body>
</html>
`;

        const emailDataAgent = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: recipient, // El agente asignado
            subject: "Nuovo Lead Dipendente",
            text: textBodyAgent,
            html: htmlBodyAgent
        };

        console.log("Enviando correo al agente...");
        await resend.emails.send(emailDataAgent);
        console.log("Correo enviado con éxito al agente.");

        // Preparar el contenido del correo para el cliente utilizando la información del agente asignado
        const agentInfo = agentInfoMapping[recipient]; // Información del agente asignado
        const clientName = `${nome} ${cognome}`;

        const textBodyClient =
            `Hola ${clientName},\n\nGracias por enviarnos tu información. El agente asignado para ayudarte es ${agentInfo ? agentInfo.name : 'nuestro agente'}.\n` +
            `${agentInfo ? "Puedes contactarlo al " + agentInfo.phone : ""}\n` +
            `Si lo deseas, también puedes agendar una llamada usando el siguiente enlace: ${agentInfo && agentInfo.calendly ? agentInfo.calendly : ""}\n\nSaludos,\nAIQuinto`;

        const htmlBodyClient = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conosci il tuo agente in Creditplan</title>
</head>
<body style="background-color: #eff6ff; margin: 0; padding: 0;">
  <div style="max-width: 32rem; margin: 0 auto; background: #ffffff; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
    <div>
      <img src="https://i.imgur.com/1avwDd5.png" alt="Intestazione della Mail" style="width: 100%; display: block;">
    </div>
    <div style="text-align: center; padding: 1rem 0;">
      <span style="font-size: 2.25rem; font-weight: bold; color: #1e3a8a;">Grazie!</span>
    </div>
    <div style="padding: 1.5rem; color: #4a5568;">
      <p style="margin-bottom: 1rem;">Ciao <strong>${clientName},</strong></p>
      <p style="margin-bottom: 1rem;">
        Ti ringraziamo per aver scelto Creditplan per le tue esigenze finanziarie. Siamo lieti di poterti supportare e ci impegniamo a fornirti l’assistenza più adeguata e personalizzata.
      </p>
      <p style="margin-bottom: 1rem;">
        Il nostro sistema ha processato la tua richiesta e, in base alla nostra organizzazione, <strong>ti è stato assegnato un agente dedicato</strong> che si occuperà di fornirti tutte le informazioni necessarie.
      </p>
      <p style="margin-bottom: 1rem;">
        Il tuo agente assegnato è <strong>${agentInfo ? agentInfo.name : 'il nostro specialista'}</strong>.
      </p>
      <p style="margin-bottom: 1rem;">
        Puoi contattarlo direttamente al numero <strong>${agentInfo ? agentInfo.phone : ''}</strong> oppure fissare una chiamata utilizzando il link qui sotto:
      </p>
      <div style="text-align: center;">
        <a href="${agentInfo && agentInfo.calendly ? agentInfo.calendly : '#'}" 
           style="display: inline-block; padding: 0.5rem 1.5rem; background-color: #1e3a8a; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 0.75rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          Fissa una chiamata
        </a>
      </div>
      <p style="margin-top: 1.5rem;">
        Siamo certi che il nostro team saprà offrirti la migliore consulenza per le tue necessità finanziarie.
      </p>
      <p style="margin-top: 0.5rem;">
        Cordiali saluti,<br>
        Il team di Creditplan
      </p>
    </div>
    <div style="background-color: #eff6ff; padding: 1rem; text-align: center; font-size: 0.875rem; color: #718096; border-top: 1px solid #e2e8f0;">
      &copy; 2025 Creditplan Società di Mediazione Creditizia. Tutti i diritti riservati.<br>
      Via Giacomo Tosi 3, Monza, MB (20900)
    </div>
  </div>
</body>
</html>
`;

        const emailDataClient = {
            from: "AIQuinto <eugenioia@resend.dev>",
            to: mail,
            subject: "Conosci il tuo agente per il settore dipendenti - Creditplan",
            text: textBodyClient,
            html: htmlBodyClient
        };

        console.log("Enviando correo al cliente...");
        await resend.emails.send(emailDataClient);
        console.log("Correo enviado con éxito al cliente.");

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
        // Autenticación y configuración de Google Sheets
        const sheets = await getGoogleSheetsClient();

        // Obtener el destinatario actual utilizando round-robin
        const recipient = AIMEDICI_RECIPIENTS[roundRobinIndex];
        console.log("Destinatario seleccionado:", recipient);

        // Actualizar el índice para el próximo agente en el round-robin
        roundRobinIndex = (roundRobinIndex + 1) % AIMEDICI_RECIPIENTS.length;
        console.log("Nuevo índice round-robin:", roundRobinIndex);

        // Obtener la hoja privada del agente correspondiente
        const agentSheetId = AIMEDICI_AGENT_SHEET_MAPPING[recipient];
        if (!agentSheetId) {
            console.error(`No se ha configurado una hoja para el agente ${recipient}`);
            return res.status(500).json({ error: 'Configuración de hoja privada faltante para el agente' });
        }

        // Guardar los datos en la hoja privada del agente
        console.log(`Guardando datos en la hoja privada del agente ${recipient} (Sheet ID: ${agentSheetId})...`);
        await sheets.spreadsheets.values.append({
            spreadsheetId: agentSheetId,
            range: "AIMedici.it!A1:J1", // Ajusta el rango según la estructura de la hoja
            valueInputOption: 'USER_ENTERED',
            requestBody: {
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
                        privacyAccepted ? "SI" : "NO"
                    ]
                ]
            }
        });
        console.log("Datos guardados correctamente en la hoja del agente.");

        // Preparar email de notificación para el agente
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

        const emailDataAgent = {
            from: "€ugenio IA <eugenioia@resend.dev>",
            to: recipient, // El agente asignado
            subject,
            text: textBody,
            html: htmlBody
        };

        console.log("Enviando correo al agente...");
        await resend.emails.send(emailDataAgent);
        console.log("Correo enviado con éxito al agente.");

        // Preparar email para el cliente utilizando la información del agente asignado
        const agentInfo = aimediciAgentInfoMapping[recipient]; // Usar el mapeo de AIMedici
        const clientName = `${nome} ${cognome}`;

        const textBodyClient = `
Hola ${clientName},

Gracias por enviarnos tu información. El agente asignado para ayudarte es ${agentInfo ? agentInfo.name : 'nuestro agente'}.
${agentInfo ? "Puedes contactarlo al " + agentInfo.phone : ""}
Si lo deseas, también puedes agendar una llamada usando el siguiente enlace: ${agentInfo && agentInfo.calendly ? agentInfo.calendly : ""}

Saludos,
AIQuinto
        `;
        const htmlBodyClient = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conosci il tuo agente in Creditplan</title>
</head>
<body style="background-color: #eff6ff; margin: 0; padding: 0;">
  <div style="max-width: 32rem; margin: 0 auto; background: #ffffff; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
    <div>
      <img src="https://i.imgur.com/dI27u5K.png" alt="Intestazione della Mail" style="width: 100%; display: block;">
    </div>
    <div style="text-align: center; padding: 1rem 0;">
      <span style="font-size: 2.25rem; font-weight: bold; color: #1e3a8a;">Grazie!</span>
    </div>
    <div style="padding: 1.5rem; color: #4a5568;">
      <p style="margin-bottom: 1rem;">Ciao <strong>${clientName},</strong></p>
      <p style="margin-bottom: 1rem;">
        Ti ringraziamo per aver scelto Creditplan per le tue esigenze finanziarie. Siamo qui per aiutarti con tutte le informazioni di cui hai bisogno.
      </p>
      <p style="margin-bottom: 1rem;">
        Il nostro sistema ha processato la tua richiesta e ti è stato assegnato un agente dedicato che ti fornirà tutte le informazioni necessarie.
      </p>
      <p style="margin-bottom: 1rem;">
        Il tuo agente assegnato è <strong>${agentInfo ? agentInfo.name : 'il nostro agente'}</strong>.
      </p>
      <p style="margin-bottom: 1rem;">
        Puoi contattarlo direttamente al numero <strong>${agentInfo ? agentInfo.phone : ''}</strong> oppure fissare una chiamata utilizzando il link qui sotto:
      </p>
      <div style="text-align: center;">
        <a href="${agentInfo && agentInfo.calendly ? agentInfo.calendly : '#'}" 
           style="display: inline-block; padding: 0.5rem 1.5rem; background-color: #1e3a8a; color: #ffffff; font-weight: bold; text-decoration: none; border-radius: 0.75rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          Fissa una chiamata
        </a>
      </div>
      <p style="margin-top: 1.5rem;">
        Siamo certi che il nostro team saprà offrirti la migliore consulenza per le tue necessità finanziarie.
      </p>
      <p style="margin-top: 0.5rem;">
        Cordiali saluti,<br>
        Il team di Creditplan
      </p>
    </div>
    <div style="background-color: #eff6ff; padding: 1rem; text-align: center; font-size: 0.875rem; color: #718096; border-top: 1px solid #e2e8f0;">
      &copy; 2025 Creditplan Società di Mediazione Creditizia. Tutti i diritti riservati.<br>
      Via Giacomo Tosi 3, Monza, MB (20900)
    </div>
  </div>
</body>
</html>
        `;

        const emailDataClient = {
            from: "AIQuinto <eugenioia@resend.dev>",
            to: mail,
            subject: "Conosci il tuo agente per il settore pensioni - Creditplan",
            text: textBodyClient,
            html: htmlBodyClient
        };

        console.log("Enviando correo al cliente...");
        await resend.emails.send(emailDataClient);
        console.log("Correo enviado con éxito al cliente.");

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