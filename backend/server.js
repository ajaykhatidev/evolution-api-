const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory message store
let messages = [];

// Environment Variables
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const AUTHENTICATION_API_KEY = process.env.AUTHENTICATION_API_KEY;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || 'crm_instance';

app.get('/', (req, res) => {
    res.send('CRM Backend for WhatsApp (Evolution API) is running!');
});

// Endpoint to receive messages from the frontend
app.get('/messages', (req, res) => {
    res.json(messages);
});

// Webhook endpoint to receive data from Evolution API
app.post('/webhook/whatsapp', (req, res) => {
    console.log('--- Webhook Received ---');
    console.log(JSON.stringify(req.body, null, 2));

    const event = req.body.event; // e.g., 'messages.upsert'
    const data = req.body.data;

    // Based on Evolution API webhook structure (Baileys)
    // event: "messages.upsert", "messages.update", etc.
    if (event === 'messages.upsert' && data.key && !data.key.fromMe) {
        const newMessage = {
            id: data.key.id,
            from: data.sender || data.key.remoteJid,
            content: data.message?.conversation || data.message?.extendedTextMessage?.text || 'Media Message/Other',
            timestamp: new Date().toLocaleTimeString(),
            isMine: false
        };
        
        messages.push(newMessage);
        console.log(`New message from ${newMessage.from}: ${newMessage.content}`);
    }

    res.status(200).send('Webhook processed');
});

// Endpoint to send WhatsApp message via Evolution API
app.post('/send-message', async (req, res) => {
    const { number, message } = req.body;

    if (!number || !message) {
        return res.status(400).json({ error: 'Number and message are required' });
    }

    // Add delay as requested (2-3 seconds)
    const delay = 2500; 
    console.log(`Delaying message send to ${number} by ${delay}ms...`);

    setTimeout(async () => {
        try {
            const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
            
            const response = await axios.post(url, {
                number: number,
                options: {
                    delay: 1200,
                    presence: "composing",
                    linkPreview: false
                },
                textMessage: {
                    text: message
                }
            }, {
                headers: {
                    'apikey': AUTHENTICATION_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Evolution API Response:', response.data);
            
            // Add to local message list for UI
            messages.push({
                id: response.data.key?.id || Date.now().toString(),
                from: 'me',
                to: number,
                content: message,
                timestamp: new Date().toLocaleTimeString(),
                isMine: true
            });

            res.json({ success: true, response: response.data });

        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            res.status(500).json({ 
                success: false, 
                error: error.response?.data?.message || error.message 
            });
        }
    }, delay);
});

app.listen(PORT, () => {
    console.log(`CRM Backend listening on port ${PORT}`);
});
