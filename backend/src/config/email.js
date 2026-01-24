import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Default sender identity (display name + email)
const DEFAULT_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Healix IT Team';
const DEFAULT_FROM_EMAIL = process.env.EMAIL_FROM || process.env.EMAIL_USER;

// Generic email template wrapper with professional design
const emailTemplate = (title, content, actionUrl = null, actionText = null) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f5f5f5;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px;
        }
        .content p {
          margin: 15px 0;
          font-size: 15px;
          line-height: 1.8;
        }
        .action-button {
          display: inline-block;
          padding: 14px 32px;
          margin: 25px 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          text-decoration: none;
          border-radius: 5px;
          font-weight: 600;
          font-size: 16px;
          transition: transform 0.2s;
        }
        .action-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .link-text {
          word-break: break-all;
          font-size: 12px;
          color: #666;
          font-family: monospace;
          background-color: #f9f9f9;
          padding: 10px;
          border-radius: 4px;
          margin: 10px 0;
        }
        .divider {
          border-top: 1px solid #e0e0e0;
          margin: 30px 0;
        }
        .footer {
          background-color: #f9f9f9;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #e0e0e0;
        }
        .footer p {
          margin: 5px 0;
        }
        .warning {
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          font-size: 14px;
        }
        .success {
          background-color: #d4edda;
          border-left: 4px solid #28a745;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
          font-size: 14px;
          color: #155724;
        }
        .highlight {
          color: #667eea;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🏥 Healix</h1>
        </div>
        
        <div class="content">
          <h2 style="color: #333; margin-top: 0;">${title}</h2>
          ${content}
          
          ${actionUrl && actionText ? `
            <div style="text-align: center;">
              <a href="${actionUrl}" class="action-button">${actionText}</a>
            </div>
            <p style="text-align: center; font-size: 13px; color: #666;">
              Or copy and paste this link in your browser:<br>
              <div class="link-text">${actionUrl}</div>
            </p>
          ` : ''}
        </div>
        
        <div class="footer">
          <p><strong>Healix</strong></p>
          <p>This is an automated message. Please do not reply directly to this email.</p>
          <p>&copy; 2026 All Rights Reserved</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Generic sendEmail function
export const sendEmail = async (to, subject, htmlContent, actionUrl = null, actionText = null) => {
  try {
    const html = typeof htmlContent === 'string' && htmlContent.includes('<html') 
      ? htmlContent 
      : emailTemplate(subject, htmlContent, actionUrl, actionText);
    
    const info = await transporter.sendMail({
      from: `${DEFAULT_FROM_NAME} <${DEFAULT_FROM_EMAIL}>`,
      to,
      subject,
      html
    });
    console.log('📧 Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
};

// Verification email template
export const sendVerificationEmail = async (email, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  const content = `
    <p>Thank you for registering with our <span class="highlight">Healix</span>.</p>
    <p>Please verify your email address by clicking the button below to complete your registration:</p>
    <div class="success">
      ✓ Once verified, your application will be reviewed by our admin team.
    </div>
  `;
  return sendEmail(email, 'Email Verification Required', content, verificationUrl, '✓ Verify Email Address');
};

// Password reset email template
export const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  const content = `
    <p>You requested to reset your password. Click the button below to proceed:</p>
    <div class="warning">
      ⏱️ This link will expire in <span class="highlight">1 hour</span>
    </div>
  `;
  return sendEmail(email, 'Password Reset Request', content, resetUrl, '🔐 Reset Password');
};

// Doctor application approval/rejection email
export const sendApplicationStatusEmail = async (email, firstName, approved, reason = '') => {
  if (approved) {
    const content = `
      <p>Dear Dr. <span class="highlight">${firstName}</span>,</p>
      <p>Congratulations! 🎉</p>
      <p>Your doctor application has been <span class="highlight">APPROVED</span>. You can now log in to the system and start managing your patients.</p>
      <div class="success">
        ✓ Your credentials are now active. Welcome to our healthcare platform!
      </div>
    `;
    return sendEmail(email, 'Doctor Application Approved', content, `${process.env.FRONTEND_URL}/login`, '📱 Login to Your Account');
  } else {
    const content = `
      <p>Dear ${firstName},</p>
      <p>Thank you for your interest in joining our healthcare platform.</p>
      <p>Unfortunately, your doctor application was <span class="highlight">NOT APPROVED</span> at this time.</p>
      ${reason ? `<div class="warning">📝 <strong>Reason:</strong> ${reason}</div>` : ''}
      <p>You may reapply in the future. If you have any questions, please contact our admin team.</p>
    `;
    return sendEmail(email, 'Application Status Update', content);
  }
};

// Welcome email
export const sendWelcomeEmail = async (email, firstName, role) => {
  const content = `
    <p>Welcome to <span class="highlight">Healthcare Management System</span>, ${firstName}!</p>
    <p>Your account has been successfully created with role: <strong>${role}</strong></p>
    <div class="success">
      ✓ Account Setup Complete
    </div>
    <p>You can now log in and start using our platform.</p>
  `;
  return sendEmail(email, 'Welcome to Healthcare Platform', content, `${process.env.FRONTEND_URL}/login`, '🚀 Get Started');
};

// Generic notification email
export const sendNotificationEmail = async (email, title, message, actionUrl = null, actionText = null) => {
  return sendEmail(email, title, message, actionUrl, actionText);
};

export default transporter;
