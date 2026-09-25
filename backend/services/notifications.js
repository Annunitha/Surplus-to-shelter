/**
 * Notification Service (FR-7)
 * MVP Channel: Email via Resend (decided in Phase 0 DECISIONS.md)
 * 
 * Provides fallback to structured logging when RESEND_API_KEY
 * is not configured, ensuring smooth operation in test and offline environments.
 */

const fs = require('fs');
const path = require('path');

// Keep in-memory buffer of sent notifications for test inspection & live demo
const sentNotifications = [];

const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  try { fs.mkdirSync(logDir, { recursive: true }); } catch (e) {}
}
const logFilePath = path.join(logDir, 'notifications.log');

function recordNotification(entry) {
  sentNotifications.unshift(entry);
  if (sentNotifications.length > 50) sentNotifications.pop();
  try {
    const line = `[${entry.timestamp}] [${entry.channel.toUpperCase()}] To: ${entry.to} | Subject: "${entry.subject}" | Status: ${entry.status}\n`;
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch (e) {}
}

async function sendEmailNotification({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  const timestamp = new Date().toISOString();

  if (!apiKey || apiKey === 're_placeholder' || apiKey === 're_placeholder_key') {
    console.log(`[Notification - Email Dispatched] To: ${to} | Subject: ${subject}`);
    const record = {
      timestamp,
      channel: 'email',
      to,
      subject,
      text,
      status: 'sent_simulated'
    };
    recordNotification(record);
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from: 'Surplus-to-Shelter <notifications@resend.dev>',
        to: [to],
        subject,
        html: html || `<p>${text}</p>`,
        text
      })
    });
    const data = await res.json();
    const record = {
      timestamp,
      channel: 'email',
      to,
      subject,
      text,
      status: res.ok ? 'sent_live' : 'failed',
      resendId: data?.id
    };
    recordNotification(record);
    return { success: res.ok, data };
  } catch (err) {
    console.error('[Notification] Failed to send email via Resend:', err.message);
    const record = {
      timestamp,
      channel: 'email',
      to,
      subject,
      text,
      status: 'error',
      error: err.message
    };
    recordNotification(record);
    return { success: false, error: err.message };
  }
}

/**
 * FR-7.1: Send notification to matched recipient when donation is offered
 */
async function notifyRecipientOffer(recipient, donation) {
  const subject = `New Food Rescue Offer: ${donation.food_description}`;
  const text = `Hello ${recipient.org_name},\n\nA new donation is available near you:\n- Description: ${donation.food_description}\n- Quantity: ${donation.quantity} ${donation.unit}\n- Pickup: ${donation.pickup_address}\n- Available until: ${donation.expiry_window_end}\n\nPlease visit your dashboard to accept or decline this offer.`;
  return sendEmailNotification({
    to: recipient.contact_email,
    subject,
    text
  });
}

/**
 * FR-7.2: Send notification to assigned driver when dispatched
 */
async function notifyDriverDispatched(driver, donation) {
  const subject = `New Pickup Assigned: ${donation.food_description}`;
  const text = `Hello ${driver.name},\n\nYou have been dispatched for a new food rescue pickup:\n- Description: ${donation.food_description}\n- Quantity: ${donation.quantity} ${donation.unit}\n- Pickup: ${donation.pickup_address}\n\nPlease check your driver portal to view full details and progress the delivery.`;
  const email = driver.email || 'driver@surplustoshelter.local';
  return sendEmailNotification({
    to: email,
    subject,
    text
  });
}

function getSentNotifications() {
  return sentNotifications;
}

function clearSentNotifications() {
  sentNotifications.length = 0;
}

module.exports = {
  sendEmailNotification,
  notifyRecipientOffer,
  notifyDriverDispatched,
  getSentNotifications,
  clearSentNotifications
};
