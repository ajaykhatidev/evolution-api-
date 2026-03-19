const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Using service role key for backend
const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase Client Initialized');

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
io.on('connection', async (socket) => {
    console.log(`Frontend Connected: ${socket.id}`);
    
    // Send initial status and messages
    try {
        const url = `${EVO_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`;
        const response = await axios.get(url, { headers: { 'apikey': API_KEY } });
        socket.emit('statusUpdate', response.data.instance?.state || 'disconnected');
    } catch (e) {
        socket.emit('statusUpdate', 'disconnected');
    }
    socket.emit('initialMessages', messages);
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

// Endpoint to get the instance status from Evolution API
app.get('/status', async (req, res) => {
    try {
        const url = `${EVO_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`;
        const response = await axios.get(url, {
            headers: { 'apikey': API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching status:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch status' });
    }
});

// Endpoint to get the QR code from Evolution API
app.get('/qr', async (req, res) => {
    try {
        const url = `${EVO_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}`;
        const response = await axios.get(url, {
            headers: { 'apikey': API_KEY }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching QR:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to fetch QR' });
    }
});

// Endpoint to create a new instance if it doesn't exist
app.post('/create-instance', async (req, res) => {
    try {
        const url = `${EVO_URL}/instance/create`;
        const response = await axios.post(url, {
            instanceName: EVOLUTION_INSTANCE_NAME,
            token: "crm_token",
            qrcode: true,
            integration: "WHATSAPP-BAILEYS",
            rejectCall: false,
            groupsIgnore: true,
            alwaysOnline: false,
            readMessages: false,
            readStatus: false,
            syncFullHistory: false
        }, {
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error creating instance:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || 'Failed to create instance' });
    }
});

// Webhook endpoint to receive data from Evolution API
app.post('/webhook/whatsapp', (req, res) => {
    console.log('--- Webhook Received ---');
    const event = req.body.event;
    const data = req.body.data;

    // Handle Connection Updates (QR, Connected, etc)
    if (event === 'connection.update') {
        const state = data.state;
        const qr = data.qr;
        
        console.log(`Connection Update: ${state}`);
        io.emit('statusUpdate', state);
        
        if (qr) {
            console.log('New QR Received via Webhook');
            io.emit('qrUpdate', qr);
        }
    }

    if (event === 'messages.upsert' && data.key && !data.key.fromMe) {
        // ... (existing message handling)
        console.log('--- Checking for sender number ---');
        console.log('RemoteJid:', data.key.remoteJid);
        console.log('PushName:', data.pushName);

        // SOURCE OF TRUTH: Evolution API often puts the true number in 'sender' field of the root
        // or we use remoteJid. Let's try to be smart.
        let senderNumber = data.key.remoteJid;
        
        const OWNER_JID = '917300733744@s.whatsapp.net';
        if (senderNumber === OWNER_JID) {
            console.log('⚠️ Skipping reply to instance owner.');
            return res.status(200).send('Ignored owner message');
        }

        const newMessage = {
            id: data.key.id,
            from: senderNumber,
            content: data.message?.conversation || data.message?.extendedTextMessage?.text || 'Media Message/Other',
            timestamp: new Date().toLocaleTimeString(),
            isMine: false
        };
        
        messages.push(newMessage);
        console.log(`New message from ${newMessage.from}: ${newMessage.content}`);
        io.emit('newMessage', newMessage);

        /* 
        // --- AUTOMATED BOT REPLY LOGIC (DISABLED BY USER) ---
        const userText = newMessage.content.toLowerCase().trim();
        const replyText = conversationFlow[userText] || conversationFlow["default"];

        setTimeout(async () => {
            try {
                console.log(`--- Bot attempting to send reply to ${senderNumber} ---`);
                const targetNumber = senderNumber.split('@')[0];
                const sendRes = await sendWhatsAppMessage(targetNumber, replyText);
                
                const botMessage = {
                    id: sendRes.data?.key?.id || `bot-${Date.now()}`,
                    from: 'bot',
                    to: senderNumber,
                    content: replyText,
                    timestamp: new Date().toLocaleTimeString(),
                    isMine: true
                };
                
                messages.push(botMessage);
                io.emit('newMessage', botMessage);
            } catch (error) {
                console.error('❌ Bot Auto-Reply error:', error.message);
            }
        }, 3000);
        */
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
