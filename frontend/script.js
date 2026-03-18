const API_URL = 'http://localhost:3000'; // Change to CRM backend URL after deployment

const sendBtn = document.getElementById('sendBtn');
const phone = document.getElementById('phone');
const message = document.getElementById('message');
const statusMessage = document.getElementById('statusMessage');
const messageLog = document.getElementById('messageLog');
const refreshBtn = document.getElementById('refreshBtn');

// Handle Send Form Submission
document.getElementById('sendForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        number: phone.value,
        message: message.value
    };

    try {
        sendBtn.disabled = true;
        sendBtn.innerText = 'Sending... (2.5s delay)';
        statusMessage.className = '';
        statusMessage.innerText = 'Wait, sending message...';

        const response = await fetch(`${API_URL}/send-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            statusMessage.className = 'success';
            statusMessage.innerText = 'Message sent successfully!';
            message.value = '';
            fetchMessages(); // Refresh log
        } else {
            throw new Error(result.error || 'Failed to send message');
        }
    } catch (error) {
        statusMessage.className = 'error';
        statusMessage.innerText = `Error: ${error.message}`;
        console.error('Send error:', error);
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerText = 'Send Message';
    }
});

// Fetch Messages from Backend
async function fetchMessages() {
    try {
        const response = await fetch(`${API_URL}/messages`);
        const messages = await response.json();

        if (messages.length === 0) {
            messageLog.innerHTML = '<p class="empty-msg">No messages received yet.</p>';
            return;
        }

        messageLog.innerHTML = '';
        messages.reverse().forEach(msg => {
            const div = document.createElement('div');
            div.className = `message-item ${msg.isMine ? 'sent' : 'received'}`;
            
            div.innerHTML = `
                <div class="meta">
                    <span>${msg.isMine ? 'To: ' + msg.to : 'From: ' + msg.from}</span>
                    <span>${msg.timestamp}</span>
                </div>
                <div class="content">${msg.content}</div>
            `;
            messageLog.appendChild(div);
        });
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

// Initial fetch and periodic refresh
fetchMessages();
refreshBtn.addEventListener('click', fetchMessages);
setInterval(fetchMessages, 5000); // Auto-refresh every 5 seconds
