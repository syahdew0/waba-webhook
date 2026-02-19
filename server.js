const express = require("express");
const crypto = require("crypto");
const axios = require("axios");

const app = express();
app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf;
        }
    })
);

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "psg_webhook_2026";
const APP_SECRET = process.env.APP_SECRET || "";
const ACCESS_TOKEN = "EAA7qEk5A1ZCwBQpia5sqRAv33dncCwboFvJVLt1ZCg7SRrPzUED0UdKfbQMh4KJLtgPBEQBeZCflr4xNZBOdV8CpzpvZAdtWtQUq74vbXMTBtZAqanR79GAM3eVObtGbQZC23dX6XsGkZB95Ns7ZALGixUvxgQRBK2BOsHjZBLcqy6yjM5xQfxuXmPDHkfZCazCvWKX0hXz3KUgRygHoxLZBZBr0YvvmUcuJfUaswdKuY";
const PHONE_NUMBER_ID = "924601814077439";


// 1️⃣ Verifikasi webhook (WA akan call ini pertama kali)
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("WEBHOOK VERIFIED");
        return res.status(200).send(challenge);
    } else {
        return res.sendStatus(403);
    }
});




function isValidSignature(req) {
    if (!APP_SECRET) return true;

    const signature = req.get("X-Hub-Signature-256");
    if (!signature) return false;

    const expected =
        "sha256=" +
        crypto.createHmac("sha256", APP_SECRET).update(req.rawBody || "").digest("hex");

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return false;

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

app.post("/webhook", (req, res) => {
    console.log("HIT /webhook");
  console.log("X-Hub-Signature-256:", req.get("X-Hub-Signature-256"));

  console.log("=== WEBHOOK RAW ===");
  console.log(JSON.stringify(req.body, null, 2));

  if (!isValidSignature(req)) {
    console.log("SIGNATURE INVALID");
    return res.sendStatus(403);
  }

  console.log("SIGNATURE OK");

    res.sendStatus(200);

    const entry = req.body?.entry || [];
    for (const e of entry) {
        const changes = e.changes || [];
        for (const c of changes) {
            const field = c.field;
            const value = c.value || {};

            const statuses = value.statuses || [];
            for (const s of statuses) {
                console.log("STATUS:", {
                    id: s.id,
                    status: s.status,
                    timestamp: s.timestamp,
                    recipient_id: s.recipient_id,
                    errors: s.errors
                });
            }

            const messages = value.messages || [];
            for (const m of messages) {
                console.log("INCOMING:", {
                    from: m.from,
                    id: m.id,
                    type: m.type,
                    text: m.text?.body
                });
            }

            if (field !== "messages") {
                console.log("Other field:", field);
            }
        }
    }
});

app.post("/template", async (req, res) => {
    const to = req.body.to; // nomor tujuan (format 628xxxx)

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                type: "template",
                template: {
                    name: "konfirmasi_order_v1",
                    language: { code: "id" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: "Budi"
                                }
                            ]
                        }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ error: "Failed to send template" });
    }
});


app.listen(3000, () => {
    console.log("Server running on port 3000");
});
