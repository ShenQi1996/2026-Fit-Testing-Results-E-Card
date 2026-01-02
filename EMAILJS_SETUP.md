# EmailJS Setup Guide

This guide will walk you through setting up EmailJS to send e-cards from your application.

## Step 1: Sign Up for EmailJS

1. Go to [https://www.emailjs.com/](https://www.emailjs.com/)
2. Click **"Sign Up"** (you can use Google, GitHub, or email)
3. The free tier includes **200 emails per month** - perfect for testing!

## Step 2: Create an Email Service

1. After logging in, go to **"Email Services"** in the left sidebar
2. Click **"Add New Service"** button
3. Choose your email provider:
   - **Gmail** (recommended for testing - easiest to set up)
   - **Outlook**
   - **Yahoo**
   - Or any SMTP service
4. Follow the setup instructions for your chosen provider:
   - For Gmail: You'll need to authorize EmailJS to send emails from your Gmail account
   - Follow the on-screen prompts to complete the connection
5. Once connected, you'll see your **Service ID** (looks like `service_xxxxx`)
   - **Copy this Service ID** - you'll need it in Step 5
   - Example format: `service_xxxxx` (your actual ID will be different)

## Step 3: Create an Email Template

1. Go to **"Email Templates"** in the left sidebar
2. Click **"Create New Template"** button
3. Fill in the template details:

   **Template Name:**
   ```
   Fit Test Results
   ```

   **Subject:**
   ```
   Fit Testing Results E-card
   ```

   **Content/Body:**
   - In the content editor, simply type:
   ```
   {{html_message}}
   ```
   - That's it! Just those two curly braces with `html_message` inside
   - The app will automatically generate the full HTML e-card and send it here

   **To Email:** ⚠️ **CRITICAL - Don't skip this!**
   - Look for a field labeled **"To Email"** or **"To"** (usually above or below the Content field)
   - In this field, type:
   ```
   {{to_email}}
   ```
   - This tells EmailJS where to send the email
   - **If you leave this empty, you'll get "recipients address is empty" error!**

4. **Important:** EmailJS automatically handles HTML when you use `{{html_message}}`
   - You don't need to find a separate "HTML format" setting
   - Just make sure you're using `{{html_message}}` (not `{{message}}`)
   - The HTML will render automatically

5. Click **"Save"** button at the bottom
6. After saving, you'll see your **Template ID** (looks like `template_xxxxx`)
   - **Copy this Template ID** - you'll need it in Step 5

## Step 4: Get Your Public Key

1. Click on **"Account"** in the left sidebar (or top menu)
2. Go to **"General"** tab
3. Scroll down to find **"Public Key"** (also called API Key)
   - It will be a long alphanumeric string
4. **Copy this Public Key** - you'll need it in Step 5

## Step 5: Update Your Code

1. Open the file: `src/services/emailService.js`
2. Find the `EMAILJS_CONFIG` object (around line 8-12)
3. Replace the placeholder values with your actual IDs:

```javascript
const EMAILJS_CONFIG = {
  SERVICE_ID: 'your_service_id_here',      // Paste your Service ID from Step 2
  TEMPLATE_ID: 'your_template_id_here',    // Paste your Template ID from Step 3
  PUBLIC_KEY: 'your_public_key_here',      // Paste your Public Key from Step 4
};
```

**Example format (replace with your actual values):**
```javascript
const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_xxxxx',             // Your Service ID (starts with 'service_')
  TEMPLATE_ID: 'template_xxxxx',            // Your Template ID (starts with 'template_')
  PUBLIC_KEY: 'your_public_key_here',      // Your Public Key (long alphanumeric string)
};
```

4. **Save the file**

## Step 6: Test It!

1. Make sure your development server is running:
   ```bash
   npm start
   ```

2. Go to the **"Send E-Card"** page in your app

3. Fill out the form with test data:
   - Enter a recipient email (use your own email for testing)
   - Fill in client name, DOB, and all other fields
   - Make sure all required fields are filled (they'll show red borders if missing)

4. Click **"Send Fit Test Results E-Card"** button

5. You should see a success message if it worked

6. **Check the recipient's email inbox** (and spam folder if needed)
   - You should receive a beautifully formatted e-card with all the fit test information
   - The email will have the company branding, QR code, and all test details

## Troubleshooting

### Email not sending?

1. **Check the browser console** (Press F12 → Console tab)
   - Look for red error messages
   - Common errors:
     - **"The recipients address is empty"** → Your EmailJS template "To Email" field is not set to `{{to_email}}`
       - Fix: Go to EmailJS dashboard → Email Templates → Edit your template
       - Make sure the "To Email" field contains: `{{to_email}}`
     - "EmailJS is not configured" → You haven't updated the IDs in `emailService.js`
     - "Invalid Public Key" → Check your Public Key is correct
     - "Template not found" → Check your Template ID is correct

2. **Verify all three IDs are correct** in `src/services/emailService.js`:
   - Service ID should start with `service_`
   - Template ID should start with `template_`
   - Public Key should be a long string

3. **Make sure your email service is connected:**
   - Go back to EmailJS dashboard → Email Services
   - Check that your service shows as "Connected" (green status)

4. **Check your template:**
   - Make sure it uses `{{html_message}}` (not `{{message}}`)
   - Make sure `{{to_email}}` is in the "To Email" field

### HTML not rendering?

- **You're using the right variable:** Make sure your template uses `{{html_message}}` (not `{{message}}`)
- **EmailJS handles HTML automatically** when you use `{{html_message}}` - no special setting needed
- If emails are coming through as plain text, double-check you're using `{{html_message}}` in the template content

### Still having issues?

1. **Test with a simple template first:**
   - Try putting just `Hello World` in the template (without variables)
   - If that works, then the issue is with the variables

2. **Check EmailJS dashboard:**
   - Go to "Email Logs" to see if emails are being sent
   - Check for any error messages there

### Free tier limits?
- EmailJS free tier: 200 emails/month
- For more emails, consider upgrading or using a backend service

## Quick Reference Checklist

Before testing, make sure you have:

- [ ] Created EmailJS account
- [ ] Created Email Service and copied Service ID
- [ ] Created Email Template with `{{html_message}}` and copied Template ID
- [ ] Copied Public Key from Account → General
- [ ] Updated all three values in `src/services/emailService.js`
- [ ] Saved the file
- [ ] Started your app with `npm start`

## Alternative: Use Environment Variables (Optional)

For better security (especially if sharing code), you can use environment variables:

1. Create a `.env` file in the project root (`email-form-app/.env`):
```
REACT_APP_EMAILJS_SERVICE_ID=your_service_id_here
REACT_APP_EMAILJS_TEMPLATE_ID=your_template_id_here
REACT_APP_EMAILJS_PUBLIC_KEY=your_public_key_here
```

2. Update `src/services/emailService.js`:
```javascript
const EMAILJS_CONFIG = {
  SERVICE_ID: process.env.REACT_APP_EMAILJS_SERVICE_ID,
  TEMPLATE_ID: process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
  PUBLIC_KEY: process.env.REACT_APP_EMAILJS_PUBLIC_KEY,
};
```

3. **Important:** Restart your development server after creating `.env` file
4. The `.env` file is already in `.gitignore`, so it won't be committed to git

## Need Help?

- EmailJS Documentation: [https://www.emailjs.com/docs/](https://www.emailjs.com/docs/)
- EmailJS Support: Check their help center or community forum

