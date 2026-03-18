#!/bin/bash

# Configuration (Replace with your own URLs and Keys)
# Evolution API is a separate service (not your CRM backend).
EVO_URL="https://evolution-api-1-qr29.onrender.com"
API_KEY="your_api_key"
CRM_BACKEND_URL="https://evolution-api-9297.onrender.com"
INSTANCE_NAME="crm_instance"

echo "Step 1: Creating Instance '$INSTANCE_NAME'..."
curl -X POST "$EVO_URL/instance/create" \
     -H "Content-Type: application/json" \
     -H "apikey: $API_KEY" \
     -d "{
           \"instanceName\": \"$INSTANCE_NAME\",
           \"token\": \"crm_token\",
           \"qrcode\": true
         }"

echo -e "\n\nStep 2: Connecting Instance (Get QR Code URL)..."
curl -X GET "$EVO_URL/instance/connect/$INSTANCE_NAME" \
     -H "apikey: $API_KEY"

echo -e "\n\nStep 3: Setting Webhook to '$CRM_BACKEND_URL'..."
curl -X POST "$EVO_URL/webhook/instance" \
     -H "Content-Type: application/json" \
     -H "apikey: $API_KEY" \
     -d "{
           \"enabled\": true,
           \"url\": \"$CRM_BACKEND_URL/webhook/whatsapp\",
           \"webhook_by_events\": false,
           \"events\": [\"MESSAGES_UPSERT\"]
         }"

echo -e "\n\nFinal Step: SCAN THE QR CODE returning from Step 2 to finish linking."
