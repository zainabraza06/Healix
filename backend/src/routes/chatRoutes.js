import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import Message from '../models/Message.js';
import Patient from '../models/Patient.js';
import Doctor from '../models/Doctor.js';
import { getIO } from '../config/socket.js';
import { isChatAllowed, getPatientByUser, getDoctorByUser } from '../middleware/chatGuard.js';

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

    res.json({ success: true, data: { id: message._id } });
  } catch (error) {
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

    res.json({ success: true, data: { id: message._id } });
  } catch (error) {
    next(error);
  }
});

export default router;
