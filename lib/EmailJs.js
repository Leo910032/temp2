const apiKey = process.env.NEXT_PUBLIC_SMTP_API;

export const EmailJs = async (
    recipientName,
    recipientEmail,
    subject,
    htmlContent
) => {
    console.log('📧 EmailJs called with click tracking disabled');

    // Validate required parameters
    if (!recipientName || !recipientEmail || !subject || !htmlContent) {
        const error = new Error('Missing required email parameters');
        console.error('❌ Email validation failed:', {
            recipientName: !!recipientName,
            recipientEmail: !!recipientEmail,
            subject: !!subject,
            htmlContent: !!htmlContent
        });
        throw error;
    }

    // Validate API key
    if (!apiKey) {
        const error = new Error('SMTP API key is not configured');
        console.error('❌ SMTP API key missing. Check NEXT_PUBLIC_SMTP_API environment variable');
        throw error;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
        const error = new Error(`Invalid email format: ${recipientEmail}`);
        console.error('❌ Invalid email format:', recipientEmail);
        throw error;
    }

    try {
        const headers = new Headers({
            'accept': 'application/json',
            'api-key': apiKey,
            'content-type': 'application/json',
        });

        // ✅ COMPLETE FIX: Multiple approaches to disable tracking
        const body = JSON.stringify({
            sender: {
                name: "TapIt Team",
                email: "noreply@tapit.fr",
            },
            to: [
                {
                    email: recipientEmail,
                    name: recipientName,
                },
            ],
            subject,
            htmlContent,
            // ✅ Method 1: Disable all tracking
            tracking: {
                clickTracking: false,
                openTracking: false,
            },
            // ✅ Method 2: Add headers to prevent tracking
            headers: {
                'X-Mailin-Custom': 'no-tracking',
                'List-Unsubscribe': '<mailto:unsubscribe@tapit.fr>',
            },
            // ✅ Method 3: Disable batch sending which can interfere with tracking settings
            batchId: null,
            // ✅ Method 4: Set delivery options
            scheduledAt: null,
            timezone: 'UTC'
        });

        console.log('📤 Sending email with ALL tracking disabled...');
        console.log('🔧 Tracking settings:', {
            clickTracking: false,
            openTracking: false,
            environment: process.env.NODE_ENV
        });

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers,
            body,
        });

        console.log('📨 Brevo API Response:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        // Get response body
        let responseData;
        try {
            const responseText = await response.text();
            if (responseText) {
                try {
                    responseData = JSON.parse(responseText);
                    console.log('📊 Parsed response data:', responseData);
                } catch (parseError) {
                    responseData = { rawText: responseText };
                }
            }
        } catch (textError) {
            console.error('❌ Could not read response text:', textError);
        }

        if (!response.ok) {
            const errorMessage = `Brevo API error: ${response.status} ${response.statusText}`;
            console.error('❌ Brevo API Error:', {
                status: response.status,
                statusText: response.statusText,
                responseData
            });
            
            const error = new Error(errorMessage);
            error.status = response.status;
            error.responseData = responseData;
            throw error;
        }

        console.log('✅ Email sent with tracking completely disabled!');
        return {
            success: true,
            response,
            data: responseData
        };

    } catch (error) {
        console.error('❌ EmailJs Error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });

        const enhancedError = new Error(`Email sending failed: ${error.message}`);
        enhancedError.originalError = error;
        enhancedError.recipientEmail = recipientEmail;
        throw enhancedError;
    }
};