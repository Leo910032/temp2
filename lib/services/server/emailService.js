// lib/services/server/emailService.js

const apiKey = process.env.NEXT_PUBLIC_SMTP_API;

export class EmailService {
    /**
     * Validates email parameters before sending
     * @private
     */
    static _validateEmailParams(recipientName, recipientEmail, subject, htmlContent) {
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
    }

    /**
     * Core email sending function using Brevo API
     * @param {string} recipientName - Name of the recipient
     * @param {string} recipientEmail - Email address of the recipient
     * @param {string} subject - Email subject
     * @param {string} htmlContent - HTML content of the email
     * @param {object} options - Additional options
     * @returns {Promise<{success: boolean, response: Response, data: any}>}
     */
    static async sendEmail(recipientName, recipientEmail, subject, htmlContent, options = {}) {
        console.log('📧 EmailService: Sending email with tracking disabled');

        // Validate all parameters
        this._validateEmailParams(recipientName, recipientEmail, subject, htmlContent);

        try {
            const headers = new Headers({
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json',
            });

            const body = JSON.stringify({
                sender: {
                    name: options.senderName || "TapIt Team",
                    email: options.senderEmail || "noreply@tapit.fr",
                },
                to: [
                    {
                        email: recipientEmail,
                        name: recipientName,
                    },
                ],
                subject,
                htmlContent,
                // Disable all tracking
                tracking: {
                    clickTracking: false,
                    openTracking: false,
                },
                // Add headers to prevent tracking
                headers: {
                    'X-Mailin-Custom': 'no-tracking',
                    'List-Unsubscribe': '<mailto:unsubscribe@tapit.fr>',
                },
                // Disable batch sending
                batchId: null,
                scheduledAt: null,
                timezone: 'UTC'
            });

            console.log('📤 Sending email with ALL tracking disabled...');
            console.log(`📧 Recipient: ${recipientEmail}`);
            console.log(`📧 Subject: ${subject}`);

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

            console.log('✅ Email sent successfully!');
            return {
                success: true,
                response,
                data: responseData
            };

        } catch (error) {
            console.error('❌ EmailService Error:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });

            const enhancedError = new Error(`Email sending failed: ${error.message}`);
            enhancedError.originalError = error;
            enhancedError.recipientEmail = recipientEmail;
            throw enhancedError;
        }
    }

    /**
     * Sends a password reset email
     * @param {string} recipientEmail - Email address to send reset link to
     * @param {string} recipientName - Name of the recipient (optional, will use email if not provided)
     * @param {string} resetUrl - The password reset URL
     * @returns {Promise<{success: boolean}>}
     */
    static async sendPasswordResetEmail(recipientEmail, recipientName, resetUrl) {
        try {
            console.log(`📧 Sending password reset email to: ${recipientEmail}`);
            
            const name = recipientName || recipientEmail.split('@')[0];
            const subject = 'Reset Your Password - TapIt';
            const htmlContent = this._generatePasswordResetTemplate(resetUrl, name);
            
            const result = await this.sendEmail(name, recipientEmail, subject, htmlContent);
            
            console.log(`✅ Password reset email sent successfully to: ${recipientEmail}`);
            return {
                success: true,
                messageId: result.data?.messageId
            };
            
        } catch (error) {
            console.error('❌ Failed to send password reset email:', error);
            throw new Error(`Failed to send password reset email: ${error.message}`);
        }
    }

    /**
     * Sends a welcome email to new users
     * @param {string} recipientEmail - Email address of new user
     * @param {string} recipientName - Name of new user  
     * @param {string} tempPassword - Temporary password (optional)
     * @returns {Promise<{success: boolean}>}
     */
    static async sendWelcomeEmail(recipientEmail, recipientName, tempPassword = null) {
        try {
            console.log(`📧 Sending welcome email to: ${recipientEmail}`);
            
            const subject = 'Welcome to TapIt - Your Account is Ready!';
            const htmlContent = this._generateWelcomeTemplate(recipientEmail, tempPassword, recipientName);
            
            const result = await this.sendEmail(recipientName, recipientEmail, subject, htmlContent);
            
            console.log(`✅ Welcome email sent successfully to: ${recipientEmail}`);
            return {
                success: true,
                messageId: result.data?.messageId
            };
            
        } catch (error) {
            console.error('❌ Failed to send welcome email:', error);
            throw new Error(`Failed to send welcome email: ${error.message}`);
        }
    }

    /**
     * Sends a team invitation email
     * @param {string} recipientEmail - Email address to invite
     * @param {string} managerName - Name of the manager sending invitation
     * @param {string} teamName - Name of the team
     * @param {string} organizationName - Name of the organization
     * @param {string} acceptUrl - URL to accept the invitation
     * @param {string} inviteCode - Invitation code
     * @param {string} type - Type of invitation ('new', 'resent', 'renewed')
     * @returns {Promise<{success: boolean}>}
     */
    static async sendTeamInvitationEmail(recipientEmail, managerName, teamName, organizationName, acceptUrl, inviteCode, type = 'new') {
        try {
            console.log(`📧 Sending team invitation email to: ${recipientEmail}`);
            
            const subject = `You're Invited to Join ${teamName} - ${organizationName}`;
            const htmlContent = this._generateTeamInvitationTemplate(
                managerName, 
                teamName, 
                organizationName, 
                acceptUrl, 
                type, 
                inviteCode
            );
            
            const recipientName = recipientEmail.split('@')[0];
            const result = await this.sendEmail(recipientName, recipientEmail, subject, htmlContent);
            
            console.log(`✅ Team invitation email sent successfully to: ${recipientEmail}`);
            return {
                success: true,
                messageId: result.data?.messageId
            };
            
        } catch (error) {
            console.error('❌ Failed to send team invitation email:', error);
            throw new Error(`Failed to send team invitation email: ${error.message}`);
        }
    }

    /**
     * Generates password reset email template
     * @private
     */
    static _generatePasswordResetTemplate(resetPasswordURL, recipientName) {
        return `
<html>
<head>
  <meta charset="utf-8">
  <title>Password Reset Email</title>
  <style type="text/css">
    @import url(https://fonts.googleapis.com/css?family=Nunito);

    :root {
      --primary-color: #674299;
      --text-color: #444;
      --background-color: #ffffff;
      --button-text-color: #ffffff;
      --button-background-color: #674299;
    }

    body {
      -webkit-font-smoothing: antialiased;
      -webkit-text-size-adjust: none;
      width: 100%;
      height: 100%;
      background: var(--background-color);
      color: var(--text-color);
      font-family: 'Nunito', sans-serif;
      font-size: 16px;
      padding: 20px;
      margin: 0;
    }

    img {
      max-width: 600px;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }

    a {
      text-decoration: none;
      border: 0;
      outline: none;
      color: var(--text-color);
    }

    a img {
      border: none;
    }

    td, h1, h2, h3 {
      font-family: 'Nunito', sans-serif;
      font-weight: 400;
    }

    td {
      text-align: center;
    }

    table {
      border-collapse: collapse !important;
    }

    .headline {
      color: var(--text-color);
      font-size: 36px;
      margin-top: 20px;
    }

    .button {
      background-color: var(--button-background-color);
      border-radius: 8px;
      color: var(--button-text-color);
      display: inline-block;
      font-family: 'Nunito', sans-serif;
      font-size: 18px;
      font-weight: 600;
      line-height: 50px;
      text-align: center;
      text-decoration: none;
      width: 350px;
      margin: 20px 0;
      padding: 15px 30px;
    }

    .footer {
      color: var(--text-color);
      margin: 20px 0;
    }

    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
    }

    .content {
      width: 75%;
      margin: 0 auto;
      text-align: left;
      line-height: 1.6;
    }

    @media only screen and (max-width: 480px) {
      .button {
        width: 300px !important;
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <table align="center" cellpadding="0" cellspacing="0" width="100%">
      <tbody>
        <tr>
          <td align="center" valign="top" width="100%">
            <center>
              <table cellpadding="0" cellspacing="0" width="600">
                <tbody>
                  <tr>
                    <td valign="top">
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td>
                            <img alt="TapIt Logo" width="155" src="https://linktree.sirv.com/Images/full-logo.png" style="padding: 1rem">
                          </td>
                        </tr>
                        <tr>
                          <td class="headline">Reset Your Password</td>
                        </tr>
                        <tr>
                          <td>
                            <center>
                              <table cellpadding="0" cellspacing="0" class="content">
                                <tbody>
                                  <tr>
                                    <td style="color: var(--text-color); font-weight: 400;">
                                      <br><br>
                                      Hi ${recipientName},
                                      <br><br>
                                      You've requested to reset your password for your TapIt account. Click the button below to create a new password:
                                      <br><br>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </center>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div>
                              <a class="button" href="${resetPasswordURL}" target="_blank">Reset My Password</a>
                            </div>
                            
                            <div style="margin-top: 20px; color: #666; font-size: 14px; line-height: 1.5;">
                              Having trouble with the button? Copy and paste this link into your browser:<br>
                              <a href="${resetPasswordURL}" style="color: #674299; word-break: break-all;">${resetPasswordURL}</a>
                            </div>
                            <br>
                          </td>
                        </tr>
                        <tr>
                          <td style="border-top: 1px solid #eee; padding-top: 30px; color: #666; font-size: 14px;">
                            <p>This password reset link will expire in 1 hour for security reasons.</p>
                            <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                            <br>
                            <p>Thank you,<br><strong>The TapIt Team</strong></p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </tbody>
              </table>
            </center>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
    }

    /**
     * Generates welcome email template  
     * @private
     */
    static _generateWelcomeTemplate(email, password, name) {
        // Use your existing welcome email template with some improvements
        return `
<style type="text/css">
  @import url(https://fonts.googleapis.com/css?family=Nunito);

  img {
    max-width: 600px;
    outline: none;
    text-decoration: none;
    -ms-interpolation-mode: bicubic;
  }
  
  html{
    margin: 0;
    padding:0;
  }

  a {
    text-decoration: none;
    border: 0;
    outline: none;
    color: #bbbbbb;
  }

  a img {
    border: none;
  }

  td, h1, h2, h3  {
    font-family: 'Nunito', Helvetica, Arial, sans-serif;
    font-weight: 400;
  }

  td {
    text-align: center;
  }

  body {
    -webkit-font-smoothing:antialiased;
    -webkit-text-size-adjust:none;
    width: 100%;
    height: 100%;
    color: #666;
    background: #fff;
    font-size: 16px;
    height: 100vh;
    width: 100%;
    padding: 0px;
    margin: 0px;
  }

   table {
    border-collapse: collapse !important;
  }

  .headline {
    color: #444;
    font-size: 36px;
  }

  .force-full-width {
   width: 100% !important;
  }

  @media screen {
    td, h1, h2, h3 {
      font-family: 'Nunito', 'Helvetica Neue', 'Arial', 'sans-serif' !important;
    }
  }

  @media only screen and (max-width: 480px) {
    table[class="w320"] {
      width: 320px !important;
    }
  }
</style>

<body bgcolor="#fff" class="body" style="padding:20px; margin:0; display:block; background:#ffffff; -webkit-text-size-adjust:none">
<table align="center" cellpadding="0" cellspacing="0" height="100%" width="100%">
<tbody><tr>
<td align="center" bgcolor="#fff" class="" valign="top" width="100%">
<center class=""><table cellpadding="0" cellspacing="0" class="w320" style="margin: 0 auto;" width="600">
<tbody><tr>
<td align="center" class="" valign="top"><table cellpadding="0" cellspacing="0" style="margin: 0 auto;" width="100%">
</table>
<table bgcolor="#fff" cellpadding="0" cellspacing="0" class="" style="margin: 0 auto; width: 100%; margin-top: 100px;">
<tbody style="margin-top: 15px;">
  <tr class="">
<td class="">
<img alt="TapIt Logo" class="" height="155" src="https://linktree.sirv.com/Images/full-logo.png">
</td>
</tr>
<tr class=""><td class="headline">Welcome to TapIt!</td></tr>
<tr>
<td>
<center class=""><table cellpadding="0" cellspacing="0" class="" style="margin: 0 auto;" width="75%"><tbody class=""><tr class="">
<td class="" style="color:#444; font-weight: 400;"><br><br>
 Welcome to TapIt - your new link management platform! We're excited to have you on board.<br><br>
 Your account has been successfully created and you can now start building your personalized link page.
 <br><br>
  ${password ? `Your login credentials are provided below:
<br>
<span style="font-weight:bold;">Email: &nbsp;</span><span style="font-weight:lighter;" class="">${email}</span> 
 <br>
  <span style="font-weight:bold;">Password: &nbsp;</span><span style="font-weight:lighter;" class="">${password}</span>
<br><br>` : ''}  
<br></td>
</tr>
</tbody></table></center>
</td>
</tr>
<tr>
<td class="">
<div class="">
<a style="background-color:#674299;border-radius:4px;color:#fff;display:inline-block;font-family:'Nunito', Helvetica, Arial, sans-serif;font-size:18px;font-weight:normal;line-height:50px;text-align:center;text-decoration:none;width:350px;-webkit-text-size-adjust:none;padding:15px 30px;" href="${process.env.NODE_ENV === 'development' ? 'http://localhost:3000/login' : `${process.env.NEXT_PUBLIC_BASE_URL}/login`}">Get Started, ${name}!</a>
</div>
 <br>
</td>
</tr>
</tbody>
  
  </table>

<table bgcolor="#fff" cellpadding="0" cellspacing="0" class="force-full-width" style="margin: 0 auto; margin-bottom: 5px:">
<tbody>
<tr>
<td class="" style="color:#444;">
<p>Thank you for joining TapIt! If you have any questions, feel free to reach out to our support team.
  </p>
  </td>
</tr>
</tbody></table></td>
</tr>
</tbody></table></center>
</td>
</tr>
</tbody></table>
</body>
`;
    }

    /**
     * Generates team invitation email template
     * @private  
     */
    static _generateTeamInvitationTemplate(managerName, teamName, organizationName, acceptUrl, type, inviteCode) {
        // Use your existing team invitation template - it's already well structured
        const typeMessages = {
            new: `<b>${managerName}</b> has invited you to join the <b>${teamName}</b> team on the <b>${organizationName}</b> enterprise account.`,
            resent: `This is a reminder - <b>${managerName}</b> has invited you to join the <b>${teamName}</b> team. We're sending you a fresh invitation with a new code.`,
            renewed: `Your invitation to join the <b>${teamName}</b> team has been renewed with a new invitation code.`
        };

        return `
<style type="text/css">
  @import url(https://fonts.googleapis.com/css?family=Nunito);
  
  /* Your existing team invitation styles */
  img {
    max-width: 600px;
    outline: none;
    text-decoration: none;
    -ms-interpolation-mode: bicubic;
  }
  
  html {
    margin: 0;
    padding: 0;
  }

  a {
    text-decoration: none;
    border: 0;
    outline: none;
    color: #bbbbbb;
  }

  a img {
    border: none;
  }

  td, h1, h2, h3 {
    font-family: 'Nunito', Helvetica, Arial, sans-serif;
    font-weight: 400;
  }

  td {
    text-align: center;
  }

  body {
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: none;
    width: 100%;
    height: 100%;
    color: #666;
    background: #fff;
    font-size: 16px;
    padding: 0px;
    margin: 0px;
  }

  table {
    border-collapse: collapse !important;
  }

  .headline {
    color: #444;
    font-size: 36px;
  }

  .button {
    background-color: #674299;
    border-radius: 8px;
    color: #fff;
    display: inline-block;
    font-family: 'Nunito', Helvetica, Arial, sans-serif;
    font-size: 18px;
    font-weight: 600;
    line-height: 54px;
    text-align: center;
    text-decoration: none;
    width: 350px;
    -webkit-text-size-adjust: none;
  }

  .invitation-code {
    background: #f8f9fa;
    border: 2px dashed #674299;
    border-radius: 8px;
    padding: 15px;
    margin: 20px 0;
    font-family: 'Courier New', monospace;
    font-size: 24px;
    font-weight: bold;
    color: #674299;
    letter-spacing: 2px;
  }
</style>

<body bgcolor="#fff" style="padding:20px; margin:0; display:block; background:#ffffff;">
<table align="center" cellpadding="0" cellspacing="0" height="100%" width="100%">
<tbody>
<tr>
<td align="center" bgcolor="#fff" valign="top" width="100%">
<center>
<table cellpadding="0" cellspacing="0" style="margin: 0 auto;" width="600">
<tbody>
<tr>
<td align="center" valign="top">
<table bgcolor="#fff" cellpadding="0" cellspacing="0" style="margin: 0 auto; width: 100%; margin-top: 50px;">
<tbody>
  <tr>
    <td>
      <img alt="TapIt Logo" height="80" src="https://linktree.sirv.com/Images/full-logo.png" style="margin-bottom: 20px;">
    </td>
  </tr>
  
  <tr>
    <td class="headline">
      ${type === 'new' ? "You're Invited!" : 
        type === 'resent' ? "Invitation Reminder" : 
        "Invitation Updated"}
    </td>
  </tr>
  
  <tr>
    <td>
      <center>
      <table cellpadding="0" cellspacing="0" style="margin: 0 auto;" width="85%">
      <tbody>
      <tr>
        <td style="color:#444; font-weight: 400; text-align: left; line-height: 1.6;">
          <br><br>
          Hello,
          <br><br>
          ${typeMessages[type] || typeMessages.new}
          <br><br>
          Click the button below to accept your invitation and get started. This invitation is valid for 7 days.
          <br><br>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="margin-bottom: 15px; color: #666; font-size: 14px;">Your invitation code:</div>
            <div class="invitation-code">${inviteCode}</div>
          </div>
        </td>
      </tr>
      </tbody>
      </table>
      </center>
    </td>
  </tr>
  
  <tr>
    <td style="padding: 30px 0;">
      <div>
        <a class="button" href="${acceptUrl}" target="_blank" rel="noopener">
          ${type === 'new' ? 'Accept Invitation' : 
            type === 'resent' ? 'Join Team Now' : 
            'Accept Updated Invitation'}
        </a>
      </div>
    </td>
  </tr>
  
  <tr>
    <td style="border-top: 1px solid #eee; padding-top: 30px; color: #666; font-size: 14px;">
      <p>
        If you didn't expect this invitation, please ignore this email.
      </p>
      <p style="margin-top: 20px;">
        Thank you,<br>
        <b>The TapIt Team</b>
      </p>
    </td>
  </tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>
</center>
</td>
</tr>
</tbody>
</table>
</body>
`;
    }
}
