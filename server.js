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