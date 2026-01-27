import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Message from '../models/Message.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import { getIO, isUserOnline } from '../config/socket.js';
import { isChatAllowed, getPatientByUser, getDoctorByUser } from '../middleware/chatGuard.js';
import { logSuccess, logFailure } from '../utils/logger.js';

const router = express.Router();

router.use(authenticate);

// Get chat history for patient with doctor (guarded)
router.get('/patient/:doctorId/history', authorize('PATIENT'), async (req, res, next) => {
  try {
    const patient = await getPatientByUser(req.user._id);
    const doctorId = req.params.doctorId;

    const allowed = await isChatAllowed(patient._id, doctorId);
    if (!allowed) return res.status(403).json({ success: false, message: 'Chat not allowed.' });

    const messages = await Message.find({ doctor_id: doctorId, patient_id: patient._id })
      .sort({ created_at: 1 }).lean();
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// Send message from patient to doctor (guarded)
router.post('/patient/:doctorId/message', authorize('PATIENT'), async (req, res, next) => {
  try {
    const patient = await getPatientByUser(req.user._id);
    const doctorId = req.params.doctorId;

    const allowed = await isChatAllowed(patient._id, doctorId);
    if (!allowed) return res.status(403).json({ success: false, message: 'Chat not allowed.' });

    const { text } = req.body;
    const message = await Message.create({
      doctor_id: doctorId,
      patient_id: patient._id,
      sender_role: 'PATIENT',
      text
    });

    const io = getIO();
    io.to(`doctor:${doctorId}`).emit('chat:receive', {
      doctorId,
      patientId: patient._id,
      message: { ...message.toObject(), id: message._id }
    });

    // Log message activity
    await logSuccess({
      req,
      userId: req.user._id,
      action: 'SEND_MESSAGE',
      entityType: 'SYSTEM',
      description: `Patient sent message to doctor ${doctorId}`,
    });

    res.json({ success: true, data: { id: message._id } });
  } catch (error) {
    await logFailure({
      req,
      userId: req.user._id,
      action: 'SEND_MESSAGE',
      entityType: 'SYSTEM',
      description: 'Failed to send message',
      error,
    });
    next(error);
  }
});

// Get chat history for doctor with patient (guarded)
router.get('/doctor/:patientId/history', authorize('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await getDoctorByUser(req.user._id);
    const patientId = req.params.patientId;

    const allowed = await isChatAllowed(patientId, doctor._id);
    if (!allowed) return res.status(403).json({ success: false, message: 'Chat not allowed.' });

    const messages = await Message.find({ doctor_id: doctor._id, patient_id: patientId })
      .sort({ created_at: 1 }).lean();
    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// Send message from doctor to patient (guarded)
router.post('/doctor/:patientId/message', authorize('DOCTOR'), async (req, res, next) => {
  try {
    const doctor = await getDoctorByUser(req.user._id);
    const patientId = req.params.patientId;

    const allowed = await isChatAllowed(patientId, doctor._id);
    if (!allowed) return res.status(403).json({ success: false, message: 'Chat not allowed.' });

    const { text } = req.body;
    const message = await Message.create({
      doctor_id: doctor._id,
      patient_id: patientId,
      sender_role: 'DOCTOR',
      text
    });

    const io = getIO();
    io.to(`patient:${patientId}`).emit('chat:receive', {
      doctorId: doctor._id,
      patientId,
      message: { ...message.toObject(), id: message._id }
    });

    // Log message activity
    await logSuccess({
      req,
      userId: req.user._id,
      action: 'SEND_MESSAGE',
      entityType: 'SYSTEM',
      description: `Doctor sent message to patient ${patientId}`,
    });

    res.json({ success: true, data: { id: message._id } });
  } catch (error) {
    await logFailure({
      req,
      userId: req.user._id,
      action: 'SEND_MESSAGE',
      entityType: 'SYSTEM',
      description: 'Failed to send message',
      error,
    });
    next(error);
  }
});

// Mark messages as delivered (when recipient receives them)
router.post('/messages/delivered', async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, message: 'messageIds array required' });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, status: 'SENT' },
      { status: 'DELIVERED', delivered_at: new Date() }
    );

    res.json({ success: true, message: 'Messages marked as delivered' });
  } catch (error) {
    next(error);
  }
});

// Mark messages as read (when recipient views them)
router.post('/messages/read', async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ success: false, message: 'messageIds array required' });
    }

    const updated = await Message.updateMany(
      { _id: { $in: messageIds } },
      { status: 'READ', read: true, read_at: new Date() }
    );

    // Emit read status update to sender
    const messages = await Message.find({ _id: { $in: messageIds } }).lean();
    const io = getIO();
    
    messages.forEach(msg => {
      const targetRoom = msg.sender_role === 'PATIENT' 
        ? `patient:${msg.patient_id}` 
        : `doctor:${msg.doctor_id}`;
      
      io.to(targetRoom).emit('chat:read', {
        messageIds,
        doctorId: msg.doctor_id,
        patientId: msg.patient_id
      });
    });

    res.json({ success: true, message: 'Messages marked as read', count: updated.modifiedCount });
  } catch (error) {
    next(error);
  }
});

// Check if doctor is online
router.get('/doctor/:doctorId/online-status', authorize('PATIENT'), async (req, res, next) => {
  try {
    const { doctorId } = req.params;
    const doctor = await Doctor.findById(doctorId).populate('user_id').lean();
    
    if (!doctor) {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }
    
    const isOnline = isUserOnline(doctor.user_id._id.toString());
    res.json({ success: true, data: { isOnline } });
  } catch (error) {
    next(error);
  }
});

export default router;
