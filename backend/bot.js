const conversationFlow = {
    "hi": "Hello there! 👋 I am your automated assistant. Type 'menu' to see what I can do.",
    "hello": "Hello there! 👋 I am your automated assistant. Type 'menu' to see what I can do.",
    "hey": "Hello there! 👋 I am your automated assistant. Type 'menu' to see what I can do.",
    
    "menu": "Please reply with a number to choose an option:\n\n1️⃣ Our Services\n2️⃣ Contact Support\n3️⃣ Pricing",
    
    "1": "💻 *Our Services:*\n- WhatsApp CRM Setup\n- Web Development\n- Cloud Hosting",
    "2": "📞 *Contact Support:*\nYou can email us at support@example.com or call 919876543210 (Mon-Fri).",
    "3": "💰 *Pricing:*\nOur basic plan starts at $49/month. Reply 'menu' to go back.",
    
    "default": "Sorry, I didn't quite get that. 😅 Just type 'hi' or 'menu' to restart our chat!"
};

module.exports = conversationFlow;
