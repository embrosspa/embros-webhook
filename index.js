const express = require("express");
const app = express();
app.use(express.json());

// ============================================================
//  CONFIGURACIÓN
// ============================================================
const VERIFY_TOKEN = "embros2024";
const WA_PHONE_NUMBER_ID = "1181823891680999";
const VENDEDOR_NUMERO = "56959441334";
const PLANTILLA_NOMBRE = "cotizacion_rapida_embros";
const PLANTILLA_IDIOMA = "es";
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN || "";
// ============================================================

const PRODUCTO_MAP = {
  gorras: "Gorras bordadas",
  poleras: "Poleras / ropa corporativa",
  prenda_propia: "Bordado sobre prenda propia",
  parches: "Parches bordados",
  otro: "Otro",
};

const CANTIDAD_MAP = {
  "1_12": "1 – 12 unidades",
  "13_24": "13 – 24 unidades",
  "25_49": "25 – 49 unidades",
  "50_99": "50 – 99 unidades",
  "100_mas": "100 o más unidades",
};

const LOGO_MAP = {
  si_archivo: "✅ Tiene archivo / logo listo",
  si_ajuste: "⚠️ Tiene logo pero necesita ajuste",
  no_orientacion: "❌ No tiene logo, necesita orientación",
};

const URGENCIA_MAP = {
  flexible: "Sin apuro / flexible",
  esta_semana: "Esta semana",
  fecha_especifica: "Tiene fecha específica",
  urgente: "🔴 URGENTE — lo antes posible",
};

const TIPO_MAP = {
  empresa: "Empresa",
  emprendimiento: "Emprendimiento",
  persona_natural: "Persona natural",
  institucion: "Institución / colegio / organización",
};

// ─── GET: verificación del webhook ───────────────────────────
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado correctamente");
    res.status(200).send(challenge);
  } else {
    console.error("❌ Verificación fallida");
    res.sendStatus(403);
  }
});

// ─── POST: recibe mensajes ────────────────────────────────────
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;
    res.sendStatus(200);

    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages) return;

    const message = value.messages[0];
    const clienteNumero = message.from;

    // Mensaje de texto → enviar plantilla con Flow
    if (message.type === "text") {
      console.log(`📩 Mensaje de ${clienteNumero} — enviando Flow`);
      await enviarPlantilla(clienteNumero);
      return;
    }

    // Respuesta del Flow completado
    if (message.type === "interactive" && message.interactive?.type === "nfm_reply") {
      const flowData = JSON.parse(message.interactive.nfm_reply.response_json);

      const producto = PRODUCTO_MAP[flowData.producto] || flowData.producto || "—";
      const cantidad = CANTIDAD_MAP[flowData.cantidad] || flowData.cantidad || "—";
      const logo = LOGO_MAP[flowData.logo] || flowData.logo || "—";
      const urgencia = URGENCIA_MAP[flowData.urgencia] || flowData.urgencia || "—";
      const tipoCliente = TIPO_MAP[flowData.tipo_cliente] || flowData.tipo_cliente || "—";
      const nombre = flowData.nombre || "—";
      const comentario = flowData.comentario || "Sin comentario";

      const resumen =
        `🧵 *NUEVO LEAD — EMBROS*\n\n` +
        `👤 *Cliente:* ${nombre}\n` +
        `📱 *WhatsApp:* +${clienteNumero}\n` +
        `🏢 *Tipo:* ${tipoCliente}\n\n` +
        `🛍️ *Producto:* ${producto}\n` +
        `📦 *Cantidad:* ${cantidad}\n` +
        `🎨 *Logo/diseño:* ${logo}\n` +
        `⏰ *Urgencia:* ${urgencia}\n\n` +
        `💬 *Comentario:* ${comentario}\n\n` +
        `━━━━━━━━━━━━━━━\n` +
        `_Responde directo a +${clienteNumero}_`;

      await enviarMensaje(VENDEDOR_NUMERO, resumen);
      console.log(`✅ Resumen enviado — Lead: ${nombre}`);

      const confirmacion = `¡Hola ${nombre}! 👋\n\nRecibimos tu solicitud en *Embros*. Un ejecutivo te contactará pronto.\n\n¡Gracias por preferirnos! 🧵`;
      await enviarMensaje(clienteNumero, confirmacion);
    }
  } catch (err) {
    console.error("Error procesando webhook:", err);
  }
});

// ─── Enviar plantilla con botón de Flow ──────────────────────
async function enviarPlantilla(destinatario) {
  const url = `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: destinatario,
    type: "template",
    template: {
      name: PLANTILLA_NOMBRE,
      language: { code: PLANTILLA_IDIOMA },
      components: [
        {
          type: "button",
          sub_type: "flow",
          index: "0",
          parameters: [
            {
              type: "action",
              action: {
                flow_token: "unused"
              }
            }
          ]
        }
      ]
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Error enviando plantilla:", JSON.stringify(data));
  } else {
    console.log(`✅ Plantilla enviada a ${destinatario}`);
  }
  return data;
}

// ─── Enviar mensaje de texto ──────────────────────────────────
async function enviarMensaje(destinatario, texto) {
  const url = `https://graph.facebook.com/v19.0/${WA_PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: destinatario,
    type: "text",
    text: { body: texto },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("Error enviando mensaje:", JSON.stringify(data));
  }
  return data;
}

// ─── Ruta de salud ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("✅ Embros Webhook activo y funcionando");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Embros Webhook corriendo en puerto ${PORT}`);
});
