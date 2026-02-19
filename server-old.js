const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

const VERIFY_TOKEN = "psg_webhook_2026";
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

app.post("/webhook", (req, res) => {
  console.log("=== RAW WEBHOOK ===");
  console.log(JSON.stringify(req.body, null, 2));
  res.sendStatus(200);
});

app.post("/send-template", async (req, res) => {
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
