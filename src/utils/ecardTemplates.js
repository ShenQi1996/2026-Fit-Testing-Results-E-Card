// Fit Testing Results E-Card Template

export const generateFitTestCard = (formData) => {
  const {
    clientName,
    dob,
    issueDate,
    fitTestType,
    respiratorMfg,
    testingAgent,
    maskSize,
    model,
    result,
    fitTester,
    recipientEmail
  } = formData;

  // Generate QR code that links to Secure Fit website
  const qrCodeUrl = 'https://next-leap-fit.vercel.app/';
  const qrCodePlaceholder = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Georgia', 'Times New Roman', serif; background-color: #e8e8e8;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8e8e8; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="800" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <!-- Blue Header with Logo and Company Name -->
              <tr>
                <td style="background: linear-gradient(135deg, #20b2aa 0%, #17a2b8 100%); padding: 30px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: middle;">
                        <!-- Logo and Company Name -->
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align: middle; padding-right: 15px;">
                              <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); border-radius: 50%; display: inline-block; position: relative;">
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 24px;">🩺</div>
                              </div>
                            </td>
                            <td style="vertical-align: middle;">
                              <h1 style="margin: 0; font-size: 32px; font-weight: bold; color: #ffffff; font-family: 'Georgia', serif; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Secure Fit LLC</h1>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Title Section on White Background -->
              <tr>
                <td style="background-color: #ffffff; padding: 20px 40px 30px 40px;">
                  <h2 style="margin: 0; font-size: 24px; font-weight: bold; color: #20b2aa; font-family: 'Georgia', serif; display: inline-block;">Fit Testing Results E-card</h2>
                  <span style="margin-left: 20px; font-size: 14px; color: #666;">Secure Fit: Precision in every breath.</span>
                </td>
              </tr>
              
              <!-- Main Content Panel -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; border: 2px solid #f0f0f0;">
                    <tr>
                      <td style="padding: 30px;">
                        <!-- Content with QR Code - Table Layout for Email Compatibility -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <!-- Left Column: QR Code and Client Info -->
                            <td width="200" valign="top" style="padding-right: 30px;">
                              <!-- Reschedule Question and QR Code -->
                              <table cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                                <tr>
                                  <td style="padding-bottom: 12px; text-align: center;">
                                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #1e3a8a; font-family: 'Georgia', serif;">
                                      Need to reschedule?
                                    </p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="text-align: center;">
                                    <img src="${qrCodePlaceholder}" alt="QR Code - Scan to reschedule" style="width: 150px; height: 150px; border: 2px solid #e0e0e0; border-radius: 4px; display: block; margin: 0 auto;" />
                                  </td>
                                </tr>
                              </table>
                              
                              <!-- Client Information -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="font-size: 16px; font-weight: bold; color: #333; display: block; margin-bottom: 8px;">Client Name:</span>
                                    <div style="padding: 8px 15px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; color: #333; font-family: 'Courier New', monospace; font-size: 14px;">
                                      ${clientName || '[Client Name]'}
                                    </div>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 20px;">
                                    <span style="font-size: 16px; font-weight: bold; color: #333; display: block; margin-bottom: 8px;">DOB:</span>
                                    <div style="padding: 8px 15px; background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; color: #333; font-family: 'Courier New', monospace; font-size: 14px;">
                                      ${dob || '[Date of Birth]'}
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                            
                            <!-- Right Column: Fit Test Details -->
                            <td valign="top">
                              <!-- Fit Test Details -->
                              <table width="100%" cellpadding="0" cellspacing="0" style="font-family: 'Courier New', monospace; font-size: 15px;">
                                <tr>
                                  <td style="padding: 8px 0; width: 40%; color: #333; font-weight: bold;">Issue Date:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${issueDate || '[Date]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Fit Test Type:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${fitTestType || '[Type]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Respirator MFG:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${respiratorMfg || '[Manufacturer]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Testing Agent:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${testingAgent || '[Agent]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Mask Size:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${maskSize || '[Size]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Model:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${model || '[Model]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Result:</td>
                                  <td style="padding: 8px 0; color: ${result === 'Pass' ? '#28a745' : result === 'Fail' ? '#dc3545' : '#333'}; text-align: right; font-weight: bold;">${result || '[Result]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #333; font-weight: bold;">Fit tester:</td>
                                  <td style="padding: 8px 0; color: #333; text-align: right;">${fitTester || '[Tester Name]'}</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

export const getCardTemplate = () => {
  return { generateFitTestCard };
};
