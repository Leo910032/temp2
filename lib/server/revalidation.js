/**
 * Revalidation Helper Functions
 * Centralized logic for triggering on-demand revalidation
 */

/**
 * Triggers revalidation for a user's public page
 * @param {string} username - The username whose page should be revalidated
 * @returns {Promise<boolean>} - Returns true if revalidation was successful, false otherwise
 */
// In your revalidation helper file

export async function revalidateUserPage(username) {
  if (!username) {
    console.warn('⚠️ Revalidation skipped: No username provided');
    return false;
  }

  // --- ADD THIS LOG to see what URL is being used ---
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ||
                  process.env.NEXT_PUBLIC_APP_URL ||
                  'http://localhost:3000';
  const revalidateUrl = `${baseUrl}/api/revalidate`;
  console.log(`[revalidateUserPage] Attempting to POST to: ${revalidateUrl}`);
  // --------------------------------------------------

  try {
    const response = await fetch(revalidateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.REVALIDATION_SECRET,
        path: `/${username}`,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Revalidation failed for /${username}:`, await response.text());
      return false;
    }

    const result = await response.json();
    console.log(`✅ Successfully revalidated page: /${username}`, result);
    return true;

  } catch (error) {
    // ✅ CHANGE THIS LINE to log the full error object
    console.error(`❌ FATAL: Error triggering revalidation for /${username}. The fetch call failed:`, error);
    return false;
  }
}

/**
 * Triggers revalidation for multiple user pages
 * @param {string[]} usernames - Array of usernames whose pages should be revalidated
 * @returns {Promise<{success: number, failed: number}>} - Count of successful and failed revalidations
 */
export async function revalidateMultipleUserPages(usernames) {
  if (!Array.isArray(usernames) || usernames.length === 0) {
    console.warn('⚠️ Revalidation skipped: No usernames provided');
    return { success: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    usernames.map(username => revalidateUserPage(username))
  );

  const success = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
  const failed = results.length - success;

  console.log(`✅ Revalidation complete: ${success} succeeded, ${failed} failed`);

  return { success, failed };
}
