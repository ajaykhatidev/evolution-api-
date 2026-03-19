#!/bin/bash

# Configuration (Replace with your own URLs and Keys)
# Evolution API is a separate service (not your CRM backend).
EVO_URL="http://localhost:8080"
API_KEY="your_secure_api_key"
CRM_BACKEND_URL="http://crm-backend:3000"
INSTANCE_NAME="crm_instance"
INTEGRATION="${INTEGRATION:-WHATSAPP-BAILEYS}"
INSTANCE_NUMBER="${INSTANCE_NUMBER:-}"

wait_for_api() {
  echo "Waiting for Evolution API at $EVO_URL ..."
  for i in {1..30}; do
    if curl -fsS "$EVO_URL" >/dev/null 2>&1; then
      echo "Evolution API is up."
      return 0
    fi
    sleep 2
  done
  echo "Evolution API did not become ready. Check container logs."
  return 1
}

wait_for_api || exit 1

if [ -z "$INSTANCE_NUMBER" ]; then
  echo "ERROR: INSTANCE_NUMBER not set. Use country code format, e.g. 919876543210"
  echo "Example: INSTANCE_NUMBER=919876543210 ./setup_session.sh"
  exit 1
fi

echo "Step 1: Creating Instance '$INSTANCE_NAME'..."
curl -X POST "$EVO_URL/instance/create" \
     -H "Content-Type: application/json" \
     -H "apikey: $API_KEY" \
     -d "{
           \"instanceName\": \"$INSTANCE_NAME\",
           \"token\": \"crm_token\",
           \"qrcode\": true,
           \"integration\": \"$INTEGRATION\",
           \"number\": \"$INSTANCE_NUMBER\",
           \"rejectCall\": false,
           \"msgCall\": \"\",
           \"groupsIgnore\": true,
           \"alwaysOnline\": false,
           \"readMessages\": false,
           \"readStatus\": false,
           \"syncFullHistory\": false
         }"

echo -e "\n\nStep 2: Connecting Instance (Get QR Code URL)..."
curl -X GET "$EVO_URL/instance/connect/$INSTANCE_NAME" \
     -H "apikey: $API_KEY"

echo -e "\n\nStep 3: (Skipped) Webhook setup for now."

echo -e "\n\nFinal Step: SCAN THE QR CODE returning from Step 2 to finish linking."
