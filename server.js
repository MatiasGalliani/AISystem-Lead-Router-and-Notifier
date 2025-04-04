const postmark = require("postmark");
require("dotenv").config();

const client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN);

async function enviarEmail() {
  try {
    const result = await client.sendEmail({
      "From": "it@creditplan.it",
      "To": "segreteria@creditplan.it",
      "Subject": "Hola desde Postmark!",
      "TextBody": "Este es un correo de prueba usando Postmark API.",
      "HtmlBody": "<strong>Este es un correo de prueba usando Postmark API.</strong>"
    });
    console.log("Email enviado exitosamente:", result);
  } catch (error) {
    console.error("Error al enviar el email:", error);
  }
}

enviarEmail();