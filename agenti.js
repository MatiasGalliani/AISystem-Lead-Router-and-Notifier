const { google } = require("googleapis");

async function getGoogleSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: "./credenciales.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const authClient = await auth.getClient();
    return google.sheets({ version: "v4", auth: authClient });
}

async function assegnaAgenteRoundRobin() {
    const sheetId = process.env.SHEET_AGENTI_ID;
    const sheets = await getGoogleSheetsClient();
    const range = "AgentiAttivi!A2:F";
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });

    const rows = res.data.values || [];

    const agentiAttivi = rows.map((r, i) => ({
        rowIndex: i + 2,
        nome: r[0],
        email: r[1],
        sheetId: r[2],
        calendly: r[3],
        stato: r[4],
        ultimoLead: r[5] || "",
    })).filter(a => a.stato?.toLowerCase() === "attivo");

    if (agentiAttivi.length === 0) throw new Error("Nessun agente attivo trovato");

    agentiAttivi.sort((a, b) => {
        if (!a.ultimoLead) return -1;
        if (!b.ultimoLead) return 1;
        return new Date(a.ultimoLead) - new Date(b.ultimoLead);
    });

    const agenteSelezionato = agentiAttivi[0];
    const ora = new Date().toISOString();

    await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `AgentiAttivi!F${agenteSelezionato.rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[ora]] },
    });

    return agenteSelezionato;
}

module.exports = { assegnaAgenteRoundRobin };
