const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const { MongoClient } = require('mongodb');

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
const MONGODB_URI = process.env.MONGODB_URI;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://crm-backend:3000/webhook/whatsapp';

app.use(cors());
app.use(bodyParser.json());

// MongoDB setup
let mongoClient = null;
let messagesCollection = null;
let messages = []; // Fallback in-memory store

async function connectMongo() {
    if (!MONGODB_URI) {
        console.warn('⚠️ MONGODB_URI not set. Using in-memory message store.');
        return;
    }
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(); // Uses DB name from URI
    messagesCollection = db.collection('messages');
    await messagesCollection.createIndex({ createdAt: 1 });
    console.log('✅ MongoDB Connected');
}

function sanitizeMessage(doc) {
    if (!doc) return doc;
    const { _id, ...rest } = doc;
    return rest;
}

async function getMessages() {
    if (!messagesCollection) return messages;
    const docs = await messagesCollection.find({}).sort({ createdAt: 1 }).limit(500).toArray();
    return docs.map(sanitizeMessage);
}

async function saveMessage(message) {
    if (messagesCollection) {
        await messagesCollection.insertOne(message);
    }
    messages.push(message);
    if (messages.length > 1000) messages.shift();
}

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
    const initialMessages = await getMessages();
    socket.emit('initialMessages', initialMessages);
});

// Environment Variables
const EVO_URL = process.env.EVO_URL || 'http://localhost:8080';
const API_KEY = process.env.API_KEY || 'your_secure_api_key';
const EVOLUTION_INSTANCE_NAME = 'crm_instance';
let isCreatingInstance = false;

// Reusable function to create instance
async function createWhatsAppInstance() {
    console.log(`🛠️ Auto-creating instance: ${EVOLUTION_INSTANCE_NAME}...`);
    const url = `${EVO_URL}/instance/create`;
    const res = await axios.post(url, {
        instanceName: EVOLUTION_INSTANCE_NAME,
        token: "crm_token",
        qrcode: true,
    }, {
        headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }
    });
    await ensureWebhook();
    return res;
}

// Reusable function to send WhatsApp via Evolution API
async function sendWhatsAppMessage(number, message) {
    const url = `${EVO_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`;
    const body = {
        number: number,
        textMessage: {
            text: message // Reverting to nested textMessage as required by the API
        },
        options: {
            delay: 1500,
            presence: "composing",
            linkPreview: false
        }
    };
    
    console.log('--- Outgoing Message to Evolution API ---');
    console.log(JSON.stringify(body, null, 2));

    return axios.post(url, body, {
        headers: {
            'apikey': API_KEY,
            'Content-Type': 'application/json'
        }
    });
}

function normalizeNumber(jidOrNumber) {
    if (!jidOrNumber) return '';
    
    // EXCEPTION: LID and Group IDs MUST keep their suffix to work with Evolution API
    // The logs prove that stripping them causes 'exists: false' errors.
    if (jidOrNumber.includes('@lid') || jidOrNumber.includes('@g.us')) {
        console.log(`Preserving identifier: ${jidOrNumber}`);
        return jidOrNumber;
    }
    
    // For standard numbers, we use just the digits
    const base = jidOrNumber.split('@')[0];
    const clean = base.replace(/\D/g, '');
    console.log(`Normalized: ${jidOrNumber} -> ${clean}`);
    return clean;
}

function resolveContactInfo(data) {
    const key = data?.key || {};
    const remoteJid = key.remoteJid || data.remoteJid || '';
    const remoteJidAlt = key.remoteJidAlt || data.remoteJidAlt || '';
    const senderPn = data.senderPn || key.senderPn || data.participantPn || key.participantPn || '';
    const participant = data.participant || key.participant || '';
    const candidate = remoteJidAlt || senderPn || participant || remoteJid;
    const contactNumber = normalizeNumber(candidate);
    const display = contactNumber || (candidate || remoteJid);
    return {
        remoteJid,
        remoteJidAlt,
        senderPn,
        contactNumber,
        display
    };
}

async function ensureWebhook() {
    try {
        const url = `${EVO_URL}/webhook/set/${EVOLUTION_INSTANCE_NAME}`;
        await axios.post(url, {
            url: WEBHOOK_URL,
            webhook_by_events: false,
            webhook_base64: false,
            events: [
                'QRCODE_UPDATED',
                'CONNECTION_UPDATE',
                'MESSAGES_UPSERT',
                'MESSAGES_UPDATE',
                'MESSAGES_DELETE',
                'SEND_MESSAGE'
            ]
        }, {
            headers: { 'apikey': API_KEY, 'Content-Type': 'application/json' }
        });
        console.log('✅ Webhook configured');
    } catch (err) {
        console.error('❌ Webhook setup failed:', err.response?.data || err.message);
    }
}

app.get('/', (req, res) => {
    res.send('CRM Backend for WhatsApp (Evolution API) is running!');
});

// Endpoint to receive messages from the frontend
app.get('/messages', (req, res) => {
    getMessages()
        .then((data) => res.json(data))
        .catch(() => res.status(500).json({ error: 'Failed to load messages' }));
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
        if (error.response?.status === 404) {
            // Silently return disconnected instead of error log
            return res.json({ instance: { state: 'disconnected' } });
        }
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
        if (error.response?.status === 404) {
            if (isCreatingInstance) {
                return res.json({ message: 'Setup in progress... please wait 10 seconds.' });
            }
            
            console.log('💡 Instance not found. Auto-creating...');
            isCreatingInstance = true;
            try {
                await createWhatsAppInstance();
                // Wait a moment for creation to settle then try connect again
                setTimeout(async () => {
                    try {
                        const retryUrl = `${EVO_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}`;
                        const retryRes = await axios.get(retryUrl, { headers: { 'apikey': API_KEY } });
                        io.emit('qrUpdate', retryRes.data.base64 || retryRes.data.code);
                    } catch (e) {} finally {
                        isCreatingInstance = false;
                    }
                }, 10000);
                return res.json({ message: 'Creating instance... QR will follow automatically via socket in 10 seconds.' });
            } catch (createErr) {
                isCreatingInstance = false;
                return res.status(500).json({ error: 'Failed to auto-create instance' });
            }
        }
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
        await ensureWebhook();
        res.json(response.data);
    } catch (error) {
        console.error('Error creating instance:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || 'Failed to create instance' });
    }
});

// Webhook endpoint to receive data from Evolution API
app.post('/webhook/whatsapp', async (req, res) => {
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
        const remoteJid = data.key.remoteJid || '';
        if (remoteJid.includes('@lid') || remoteJid.includes('@g.us')) {
            console.log(`Ignoring message from non-standard contact: ${remoteJid}`);
            return res.sendStatus(200);
        }
        
        console.log('--- Checking for sender number ---');
        console.log('RemoteJid:', data.key.remoteJid);
        console.log('PushName:', data.pushName);

        // SOURCE OF TRUTH: Evolution API often puts the true number in 'sender' field of the root
        // or we use remoteJid. Let's try to be smart.
        const contactInfo = resolveContactInfo(data);
        let senderNumber = contactInfo.remoteJid || contactInfo.display;
        if ((contactInfo.remoteJid || '').includes('@lid') && contactInfo.contactNumber) {
            senderNumber = `${contactInfo.contactNumber}@s.whatsapp.net`;
        }
        if ((contactInfo.remoteJid || '').includes('@lid') && !contactInfo.contactNumber) {
            console.warn('⚠️ LID detected without phone number. Reply may fail.', {
                remoteJid: contactInfo.remoteJid,
                remoteJidAlt: contactInfo.remoteJidAlt,
                senderPn: contactInfo.senderPn
            });
        }
        
        const newMessage = {
            id: data.key.id,
            from: senderNumber,
            pushName: data.pushName, // Store PushName for display
            contact: contactInfo.contactNumber || senderNumber.split('@')[0],
            content: data.message?.conversation || data.message?.extendedTextMessage?.text || 'Media Message/Other',
            timestamp: new Date().toLocaleTimeString(),
            isMine: false,
            createdAt: new Date()
        };
        
        await saveMessage(newMessage);
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
    const targetNumber = normalizeNumber(number);
    if (!targetNumber) {
        return res.status(400).json({ error: 'Invalid target number. Please provide a valid phone number or WhatsApp ID.' });
    }
    console.log(`Delaying message send to ${targetNumber} by ${delay}ms...`);

    setTimeout(async () => {
        try {
            const response = await sendWhatsAppMessage(targetNumber, message);

            console.log('Evolution API Response:', response.data);
            
            const sentMessage = {
                id: response.data.key?.id || Date.now().toString(),
                from: 'me',
                to: targetNumber,
                contact: targetNumber,
                content: message,
                timestamp: new Date().toLocaleTimeString(),
                isMine: true,
                createdAt: new Date()
            };
            
            await saveMessage(sentMessage);

            // Push update to frontend real-time
            io.emit('newMessage', sentMessage);

            res.json({ success: true, response: response.data });

        } catch (error) {
            console.error('Error sending message:', JSON.stringify(error.response?.data || error.message, null, 2));
            res.status(500).json({ 
                success: false, 
                error: error.response?.data || error.message 
            });
        }
    }, delay);
});

async function startServer() {
    try {
        await connectMongo();
        await ensureWebhook();
    } catch (err) {
        console.error('❌ MongoDB connection failed:', err.message);
    }
    server.listen(PORT, () => {
        console.log(`CRM Backend listening on port ${PORT} with WebSockets enabled`);
    });
}

startServer();
