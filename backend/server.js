const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow frontend to connect
        methods: ["GET", "POST"]
    }
});

const conversationFlow = require('./bot'); // Import our auto-reply bot logic

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Socket.io Connection Logic
io.on('connection', (socket) => {
    console.log(`Frontend Connected: ${socket.id}`);
});

// In-memory message store
let messages = [];

// Environment Variables
const EVO_URL = process.env.EVO_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'your_secure_api_key';
const EVOLUTION_INSTANCE_NAME = 'crm_instance';

// Reusable function to send WhatsApp via Evolution API
async function sendWhatsAppMessage(number, message) {
    const url = `${EVO_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    return axios.post(url, {
        number: number,
        options: {
            delay: 1500, // natural typing delay
            presence: "composing",
            linkPreview: false
        },
        textMessage: { text: message }
    }, {
        headers: {
            'apikey': API_KEY,
            'Content-Type': 'application/json'
        }
    });
}

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
            from: req.body.sender || data.key.remoteJid, // Fix to get correct WhatsApp number
            content: data.message?.conversation || data.message?.extendedTextMessage?.text || 'Media Message/Other',
            timestamp: new Date().toLocaleTimeString(),
            isMine: false
        };
        
        messages.push(newMessage);
        console.log(`New message from ${newMessage.from}: ${newMessage.content}`);
        
        // Push update to frontend real-time
        io.emit('newMessage', newMessage);

        // --- AUTOMATED BOT REPLY LOGIC ---
        const userText = newMessage.content.toLowerCase().trim();
        const replyText = conversationFlow[userText] || conversationFlow["default"];

        console.log(`Bot replying to ${newMessage.from}: ${replyText}`);

        setTimeout(async () => {
            try {
                const sendRes = await sendWhatsAppMessage(newMessage.from, replyText);
                
                const botMessage = {
                    id: sendRes.data.key?.id || Date.now().toString(),
                    from: 'bot',
                    to: newMessage.from,
                    content: replyText,
                    timestamp: new Date().toLocaleTimeString(),
                    isMine: true
                };
                
                messages.push(botMessage);
                io.emit('newMessage', botMessage);

            } catch (error) {
                console.error('Bot Auto-Reply error:', error.message);
            }
        }, 3000); // 3 seconds delay to reply naturally
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
            const response = await sendWhatsAppMessage(number, message);

            console.log('Evolution API Response:', response.data);
            
            const sentMessage = {
                id: response.data.key?.id || Date.now().toString(),
                from: 'me',
                to: number,
                content: message,
                timestamp: new Date().toLocaleTimeString(),
                isMine: true
            };
            
            // Add to local message list for UI
            messages.push(sentMessage);

            // Push update to frontend real-time
            io.emit('newMessage', sentMessage);

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

server.listen(PORT, () => {
    console.log(`CRM Backend listening on port ${PORT} with WebSockets enabled`);
});
