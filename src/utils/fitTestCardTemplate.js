// Fit Testing Results E-Card Template
import { calculateExpirationDate } from './dateUtils';

export const generateFitTestCard = (formData) => {
  const {
    clientName,
    dob,
    testLocation,
    issueDate,
    expirationDate,
    fitTestType,
    respiratorMfg,
    testingAgent,
    maskSize,
    model,
    result,
    fitTester,
    recipientEmail,
  } = formData;

  const displayExpirationDate = expirationDate || calculateExpirationDate(issueDate);

  // Route QR destination by selected testing location.
  const LOCATION_QR_URLS = {
    Harlem: 'https://next-leap-fit.vercel.app/',
    Brooklyn: 'https://next-leap-fit-bk-2026.vercel.app/',
  };
  // Custom "Other" locations have no booking site of their own and land here.
  const DEFAULT_QR_URL = LOCATION_QR_URLS.Harlem;
  const qrCodeUrl = LOCATION_QR_URLS[testLocation] || DEFAULT_QR_URL;
  const qrCodePlaceholder = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrCodeUrl)}`;
  const logoUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/secure-fit-logo.png`
    : '/secure-fit-logo.png';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f8f9fa;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; padding: 32px 20px;">
        <tr>
          <td align="center">
            <table width="800" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <!-- Blue Header with Logo and Company Name -->
              <tr>
                <td style="background: linear-gradient(135deg, #007E66 0%, #00B499 100%); padding: 26px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: middle;">
                        <!-- Logo and Company Name -->
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align: middle; padding-right: 15px;">
                              <img src="${logoUrl}" alt="Secure Fit logo" style="width: 56px; height: 56px; border-radius: 8px; display: block; object-fit: contain;" />
                            </td>
                            <td style="vertical-align: middle;">
                              <h1 style="margin: 0; font-size: 30px; font-weight: 700; color: #ffffff; font-family: Arial, Helvetica, sans-serif;">Secure Fit LLC</h1>
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
                <td style="background-color: #ffffff; padding: 20px 40px 16px 40px;">
                  <h2 style="margin: 0; font-size: 25px; font-weight: 700; color: #005889; font-family: Arial, Helvetica, sans-serif; display: inline-block;">Fit Testing Results E-card</h2>
                  <span style="margin-left: 16px; font-size: 14px; color: #666;">Secure Fit: Precision in every breath.</span>
                </td>
              </tr>

              <tr>
                <td style="background-color: #ffffff; padding: 0 40px 24px 40px;">
                  <span style="display: inline-block; padding: 5px 10px; border-radius: 999px; background-color: #e8f8f4; color: #007E66; font-size: 12px; font-weight: 600; margin-right: 8px;">OSHA-Aligned Protocols</span>
                  <span style="display: inline-block; padding: 5px 10px; border-radius: 999px; background-color: #e8f2f8; color: #005889; font-size: 12px; font-weight: 600;">Certified Technicians</span>
                </td>
              </tr>
              
              <!-- Main Content Panel -->
              <tr>
                <td style="background-color: #ffffff; padding: 0 40px 40px 40px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; border: 1px solid rgba(0, 88, 137, 0.15);">
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
                                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #005889; font-family: Arial, Helvetica, sans-serif;">
                                      Need to reschedule?
                                    </p>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="text-align: center;">
                                    <img src="${qrCodePlaceholder}" alt="QR Code - Scan to reschedule" style="width: 150px; height: 150px; border: 2px solid rgba(0, 126, 102, 0.35); border-radius: 8px; display: block; margin: 0 auto;" />
                                  </td>
                                </tr>
                              </table>
                              
                              <!-- Client Information -->
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="padding-bottom: 15px;">
                                    <span style="font-size: 14px; font-weight: 600; color: #005889; display: block; margin-bottom: 8px;">Client Name:</span>
                                    <div style="padding: 9px 14px; background-color: #f8f9fa; border: 1px solid rgba(0, 88, 137, 0.15); border-radius: 6px; color: #444; font-family: 'Courier New', monospace; font-size: 14px;">
                                      ${clientName || '[Client Name]'}
                                    </div>
                                  </td>
                                </tr>
                                <tr>
                                  <td style="padding-bottom: 20px;">
                                    <span style="font-size: 14px; font-weight: 600; color: #005889; display: block; margin-bottom: 8px;">DOB:</span>
                                    <div style="padding: 9px 14px; background-color: #f8f9fa; border: 1px solid rgba(0, 88, 137, 0.15); border-radius: 6px; color: #444; font-family: 'Courier New', monospace; font-size: 14px;">
                                      ${dob || '[Date of Birth]'}
                                    </div>
                                  </td>
                                </tr>
                              </table>
                            </td>
                            
                            <!-- Right Column: Fit Test Details -->
                            <td valign="top">
                              <!-- Fit Test Details -->
                              <table width="100%" cellpadding="0" cellspacing="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px;">
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Test Location:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${testLocation || '[Location]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; width: 40%; color: #005889; font-weight: 600;">Issue Date:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${issueDate || '[Date]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Expiration Date:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${displayExpirationDate || '[Date]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Fit Test Type:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${fitTestType || '[Type]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Respirator MFG:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${respiratorMfg || '[Manufacturer]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Testing Agent:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${testingAgent || '[Agent]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Mask Size:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${maskSize || '[Size]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Model:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${model || '[Model]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Result:</td>
                                  <td style="padding: 8px 0; color: ${result === 'Pass' ? '#28a745' : result === 'Fail' ? '#dc3545' : '#333'}; text-align: right; font-weight: bold;">${result || '[Result]'}</td>
                                </tr>
                                <tr>
                                  <td style="padding: 8px 0; color: #005889; font-weight: 600;">Fit tester:</td>
                                  <td style="padding: 8px 0; color: #444; text-align: right; font-weight: 500;">${fitTester || '[Tester Name]'}</td>
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
