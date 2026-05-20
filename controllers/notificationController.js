

/**
 * Process Notification Controller
 * 
 * Handles incoming notification requests forwarded by the Adapter Layer (Group 2).
 * The Adapter Layer is the ONLY external actor that directly calls this endpoint,
 * routing requests from various microservices (Appointment System, Queue System, etc.)
 * on their behalf.
 * 
 * Implements duplicate detection, email sending, and database logging.
 * 
 * Request body format (forwarded by Adapter Layer):
 * {
 *   "senderSystem": "string" (optional - original sender's name, e.g., "Appointment System"),
 *   "recipientEmail": "string",
 *   "subject": "string",
 *   "message": "string"
 * }
 * 
 * If senderSystem is not provided, it will be auto-detected from the JWT token's role.
 */


import NotificationLog from '../models/NotificationLog.js';

export const processNotification = async (req, res) => {
  try {
    const {
      senderSystem: providedSenderSystem,
      recipientEmail,
      subject,
      message
    } = req.body;

    if (!recipientEmail || !subject || !message) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'Recipient email, subject, and message are required.'
      });
    }

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({
        code: 'INVALID_EMAIL',
        message: 'Invalid email format for recipientEmail.'
      });
    }

    let senderSystem = 'Unknown System';

    if (providedSenderSystem) {
      senderSystem = providedSenderSystem;
    } else if (req.user?.role) {
      switch (req.user.role.toLowerCase()) {
        case 'doctor':
          senderSystem = 'Doctor Portal';
          break;
        case 'patient':
          senderSystem = 'Patient Portal';
          break;
        case 'admin':
          senderSystem = 'Admin System';
          break;
        default:
          senderSystem = `${req.user.role} System`;
      }
    }

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const duplicateExists = await NotificationLog.findOne({
      recipientEmail,
      message,
      status: { $in: ['Sent', 'Duplicate'] },
      createdAt: { $gte: fiveMinutesAgo }
    });

    if (duplicateExists) {
      const dupLog = await NotificationLog.create({
        senderSystem,
        recipientEmail,
        subject,
        message,
        status: 'Duplicate',
        emailSent: false,
        errorMessage: 'Duplicate notification detected within 5 minutes.',
        senderEmail: req.user?.email || null
      });

      return res.status(409).json({
        code: 'DUPLICATE_NOTIFICATION',
        message: 'A similar notification was already sent within the last 5 minutes.',
        logId: dupLog._id
      });
    }

    let emailSent = false;
    let sendEmailError = null;

    try {
      await sendEmail(recipientEmail, subject, message);
      emailSent = true;
    } catch (error) {
      emailSent = false;
      sendEmailError = error.message;

      console.error(`Failed to send email:`, error);
    }

    const savedLog = await NotificationLog.create({
      senderSystem,
      recipientEmail,
      subject,
      message,
      status: emailSent ? 'Sent' : 'Failed',
      emailSent,
      sendEmailError,
      senderEmail: req.user?.email || null
    });

    if (emailSent) {
      return res.status(200).json({
        code: 'NOTIFICATION_SENT',
        message: 'Notification successfully processed and sent.',
        logId: savedLog._id,
        senderSystem: savedLog.senderSystem,
        recipientEmail: savedLog.recipientEmail,
        sentAt: savedLog.createdAt
      });
    }

    return res.status(500).json({
      code: 'EMAIL_SEND_FAILED',
      message: 'Notification processed but email sending failed.',
      logId: savedLog._id,
      error: sendEmailError
    });

  } catch (error) {
    console.error('Unexpected error:', error);

    
    const errorLog = await NotificationLog.create({
      senderSystem:
        req.body?.senderSystem ||
        (req.user?.role ? `${req.user.role} System` : 'Unknown System'),

      recipientEmail: req.body?.recipientEmail || 'unknown_recipient',
      subject: req.body?.subject || 'unknown_subject',
      message: req.body?.message || 'unknown_message',

      status: 'Failed',
      emailSent: false,
      errorMessage: error.message,
      senderEmail: req.user?.email || null
    });

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected internal server error occurred.',
      logId: errorLog._id,
      error: error.message
    });
  }

  const errorLog = await NotificationLog.create({
    senderSystem:
        req.body?.senderSystem ||
        (req.user?.role ? `${req.user.role} System` : 'Unknown System'),

    recipientEmail: req.body?.recipientEmail || 'unknown_recipient',
    subject: req.body?.subject || 'unknown_subject',
    message: req.body?.message || 'unknown_message',

    status: 'Failed',
    emailSent: false,
    errorMessage: error.message,
    senderEmail: req.user?.email || null
    });
};

export const getNotificationLogs = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, recipientEmail } = req.query;

        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);

        const skip = (parsedPage - 1) * parsedLimit;

        let query = {};

        if (!req.user || !req.user.role) {
      query.recipientEmail = 'unauthorized_access';
    } else {
      const role = req.user.role.toLowerCase();

      if (role === 'patient') {
        query.recipientEmail = req.user.email;
      }

       if (role === 'doctor') {
        query.senderEmail = req.user.email;
      }
        }
    }
}


    