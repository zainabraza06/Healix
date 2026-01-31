import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';

dotenv.config();

const addTestAppointments = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    // Find existing doctor and patient
    const doctor = await Doctor.findOne().populate('user_id');
    const patient = await Patient.findOne().populate('user_id');

    if (!doctor || !patient) {
      console.log('❌ No doctor or patient found. Please ensure users exist first.');
      return;
    }

    console.log(`Found doctor: ${doctor.user_id.full_name}`);
    console.log(`Found patient: ${patient.user_id.full_name}`);

    // Create two past appointments
    const pastDate1 = new Date('2025-01-15'); // January 15, 2025
    const pastDate2 = new Date('2025-01-20'); // January 20, 2025

    const appointment1 = new Appointment({
      patient_id: patient._id,
      doctor_id: doctor._id,
      appointment_date: pastDate1,
      slot_start_time: '10:00',
      slot_end_time: '10:30',
      appointment_type: 'ONLINE',
      status: 'COMPLETED',
      reason: 'Regular checkup - Test Appointment 1',
      payment_status: 'PAID',
      payment_amount: 1000,
      completed_at: new Date('2025-01-15T10:30:00Z'),
      patient_attended: true,
      chat_enabled: true
    });

    const appointment2 = new Appointment({
      patient_id: patient._id,
      doctor_id: doctor._id,
      appointment_date: pastDate2,
      slot_start_time: '14:00',
      slot_end_time: '14:30',
      appointment_type: 'OFFLINE',
      status: 'COMPLETED',
      reason: 'Follow-up consultation - Test Appointment 2',
      payment_status: 'PAID',
      payment_amount: 1000,
      completed_at: new Date('2025-01-20T14:30:00Z'),
      patient_attended: true,
      chat_enabled: true
    });

    await appointment1.save();
    await appointment2.save();

    console.log('✅ Successfully added 2 test past appointments');
    console.log(`Appointment 1: ${pastDate1.toDateString()} at 10:00 - COMPLETED`);
    console.log(`Appointment 2: ${pastDate2.toDateString()} at 14:00 - COMPLETED`);

  } catch (error) {
    console.error('❌ Error adding test appointments:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
};

addTestAppointments();