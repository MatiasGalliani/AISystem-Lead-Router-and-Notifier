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
    const ID_SHEET_AGENTI = process.env.SHEET_AGENTI_ID; // ID del documento "Agenti AIQuinto.it"
    const sheets = await getGoogleSheetsClient();

    const range = "AgentiAttivi!A2:F"; // Asumimos que los headers están en A1:F1
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: ID_SHEET_AGENTI,
        range,
    });

    const rows = res.data.values || [];

    const agentiAttivi = rows
        .map((r, index) => ({
            rowIndex: index + 2, // porque la hoja empieza en A2
            nome: r[0],
            email: r[1],
            sheetId: r[2],
            calendly: r[3],
            stato: r[4],
            ultimoLead: r[5] || ""
        }))
        .filter(a => a.stato?.toLowerCase() === "attivo");

    if (agentiAttivi.length === 0) {
        throw new Error("❌ No hay agentes activos disponibles.");
    }

    // Ordenar por fecha de último lead (el más antiguo primero)
    agentiAttivi.sort((a, b) => {
        if (!a.ultimoLead) return -1;
        if (!b.ultimoLead) return 1;
        return new Date(a.ultimoLead) - new Date(b.ultimoLead);
    });

    const agenteSeleccionado = agentiAttivi[0];

    // Registrar la hora actual como último lead asignado
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.update({
        spreadsheetId: ID_SHEET_AGENTI,
        range: `AgentiAttivi!F${agenteSeleccionado.rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: [[now]]
        }
    });

    return agenteSeleccionado;
}

module.exports = { assegnaAgenteRoundRobin };