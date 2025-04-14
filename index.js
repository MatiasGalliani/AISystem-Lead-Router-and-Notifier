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
        const emailAgente = {
            from: "Eugenio IA <eugenioia@resend.dev>",
            to: agente.email,
            subject: "🔔 Nuevo Lead Asignado",
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
        };
        await resend.emails.send(emailAgente);

        // 📩 Email al cliente con link del agente
        const emailClienteConfirm = {
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
        };
        await resend.emails.send(emailClienteConfirm);

        res.json({ message: 'Lead asignado y notificaciones enviadas correctamente' });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: 'Error al procesar el lead' });
    }
});
