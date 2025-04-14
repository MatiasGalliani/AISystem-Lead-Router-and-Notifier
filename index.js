const express = require('express');
const { google } = require('googleapis');
const { Resend } = require("resend");
require('dotenv').config();
const { assegnaAgenteRoundRobin } = require('./agenti');

const app = express();
const resend = new Resend(process.env.RESEND_API_KEY);
const PORT = process.env.PORT || 3500;

// Middleware para CORS personalizado (resuelve preflight error)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://www.aiquinto.it");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

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
    const datos = req.body.datos;

    if (!Array.isArray(datos)) {
      return res.status(400).json({ error: 'Datos debe ser un array' });
    }

    const nome = req.body.nome || datos[0] || 'Non specificato';
    const cognome = req.body.cognome || datos[1] || 'Non specificato';
    const emailCliente = req.body.email || datos[2] || 'Non specificato';
    const telefono = req.body.telefono || datos[3] || 'Non specificato';

    // 🌀 Obtener agente disponible y su Sheet_ID
    const agente = await assegnaAgenteRoundRobin(); // viene de agenti.js

    // 📤 Guardar en el Google Sheet privado del agente
    await sheets.spreadsheets.values.append({
      spreadsheetId: agente.sheetId,
      range: "Leads!A1:E1", // Cambia si tu hoja se llama distinto
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          new Date().toLocaleString("it-IT"),
          nome,
          cognome,
          emailCliente,
          telefono
        ]],
      },
    });

    // 📩 Email al agente con los datos del cliente
    await resend.emails.send({
      from: "Eugenio IA <eugenioia@resend.dev>",
      to: agente.email,
      subject: "🔔 Nuevo Lead Asignato",
      text: `Nuevo lead manual\nNombre: ${nome}\nCognome: ${cognome}\nEmail: ${emailCliente}\nTeléfono: ${telefono}`,
      html: `
        <html><body>
        <h3>Nuevo Lead Manual</h3>
        <p><strong>Nombre:</strong> ${nome}</p>
        <p><strong>Apellido:</strong> ${cognome}</p>
        <p><strong>Email:</strong> ${emailCliente}</p>
        <p><strong>Teléfono:</strong> ${telefono}</p>
        </body></html>
      `
    });

    // 📩 Email al cliente con link del agente
    await resend.emails.send({
      from: "Eugenio IA <eugenioia@resend.dev>",
      to: emailCliente,
      subject: "Gracias por tu solicitud",
      text: `Tu asesor será ${agente.nome}. Puedes reservar una llamada en este enlace: ${agente.calendly}`,
      html: `
        <html><body>
        <h3>Gracias por tu solicitud</h3>
        <p>Tu asesor será <strong>${agente.nome}</strong>.</p>
        <p>Puedes reservar una llamada aquí: <a href="${agente.calendly}">${agente.calendly}</a></p>
        </body></html>
      `
    });

    res.json({ message: 'Lead asignado y notificaciones enviadas correctamente' });

  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Error al procesar el lead' });
  }
});

app.listen(PORT, () => {
  console.log('🚀 Servidor corriendo en el puerto', PORT);
});
