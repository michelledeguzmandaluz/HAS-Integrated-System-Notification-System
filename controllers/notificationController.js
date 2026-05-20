

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
}