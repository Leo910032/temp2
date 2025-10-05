// In functions/subscriptionChangeHandler.js

const functions = require("firebase-functions");
const fetch = require("node-fetch");

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

  // Get secrets from Firebase Functions config
  const secret = functions.config().app.webhook_secret;
  const baseUrl = functions.config().app.base_url;

  if (!secret || !baseUrl) {
    console.error(
        "Missing webhook_secret or base_url in Firebase Functions config.",
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
  // For now, we'll just say any change is significant.
  return oldLevel !== newLevel;
}

module.exports = {
  handleSubscriptionChange,
  affectsAppearanceFeatures,
};
