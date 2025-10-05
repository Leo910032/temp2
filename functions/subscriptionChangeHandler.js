// In functions/subscriptionChangeHandler.js

const fetch = require("node-fetch");
// ✅ CHANGE: Import tools for handling environment variables in v2
const {defineString} = require("firebase-functions/params");

// ✅ CHANGE: Define the environment variables your function needs
const WEBHOOK_SECRET = defineString("APP_WEBHOOK_SECRET");
const BASE_URL = defineString("APP_BASE_URL");


/**
 * Calls the Vercel webhook to trigger revalidation.
 * @param {object} data - The subscription change data.
 * @param {string} data.username - The user's username.
 */
async function handleSubscriptionChange(data) {
  const {username} = data;
  if (!username) {
    console.warn("handleSubscriptionChange: No username provided, skipping.");
    return;
  }

  // ✅ CHANGE: Access the variables using .value()
  const secret = WEBHOOK_SECRET.value();
  const baseUrl = BASE_URL.value();

  if (!secret || !baseUrl) {
    console.error(
        "Missing APP_WEBHOOK_SECRET or APP_BASE_URL in environment config.",
    );
    return;
  }

  console.log(`Triggering revalidation for user: ${username} on ${baseUrl}`);

  try {
    const response = await fetch(`${baseUrl}/api/webhooks/subscription-change`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
          `Webhook call failed for ${username}: ${response.status}`,
          errorText,
      );
    } else {
      console.log(`Successfully called webhook for ${username}.`);
    }
  } catch (error) {
    console.error(`Error calling webhook for ${username}:`, error);
  }
}

/**
 * Checks if a subscription change affects premium features.
 * @param {string} oldLevel - The user's previous subscription level.
 * @param {string} newLevel - The user's new subscription level.
 * @return {boolean} - True if the change is significant.
 */
function affectsAppearanceFeatures(oldLevel, newLevel) {
  return oldLevel !== newLevel;
}

module.exports = {
  handleSubscriptionChange,
  affectsAppearanceFeatures,
};
