// In functions/index.js

const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {
  handleSubscriptionChange,
  affectsAppearanceFeatures,
} = require("./subscriptionChangeHandler");

exports.onUserSubscriptionChange = onDocumentUpdated(
    "users/{userId}",
    async (event) => {
      // Get the data before and after the change
      const beforeData = event.data.before.data();
      const afterData = event.data.after.data();
      const userId = event.params.userId;

      // IMPORTANT: Use your "accountType" field
      const oldLevel = beforeData.accountType;
      const newLevel = afterData.accountType;
      const username = afterData.username;

      console.log(
          `Checking user ${userId} (${username}). ` +
          `Account type changed from '${oldLevel}' to '${newLevel}'.`,
      );

      // Only trigger if the subscription level actually changed
      if (oldLevel !== newLevel && affectsAppearanceFeatures(oldLevel, newLevel)) {
        console.log(
            `Subscription change for ${username} affects appearance. ` +
            "Triggering revalidation.",
        );
        await handleSubscriptionChange({
          userId,
          username,
          oldLevel,
          newLevel,
        });
      } else {
        console.log(
            `No significant subscription change for ${username}. ` +
            "Skipping revalidation.",
        );
      }
    },
);
