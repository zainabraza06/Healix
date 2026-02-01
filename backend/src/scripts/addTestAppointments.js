import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Appointment from '../models/Appointment.js';
import Doctor from '../models/Doctor.js';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import Prescription from '../models/Prescription.js';
import bcrypt from 'bcryptjs';

dotenv.config();

const addTestAppointments = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL);
    console.log('✅ Connected to MongoDB');

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const dateWithOffset = (daysOffset) => {
      const d = new Date(today);
      d.setDate(d.getDate() + daysOffset);
      return d;
    };

    const addMinutesToTime = (timeStr, minutesToAdd) => {
      const [h, m] = timeStr.split(':').map(Number);
      const base = new Date();
      base.setHours(h || 0, m || 0, 0, 0);
      base.setMinutes(base.getMinutes() + minutesToAdd);
      return `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
    };

    const getSafePastTime = () => {
      const candidate = new Date(now);
      candidate.setMinutes(candidate.getMinutes() - 120);
      const roundedMinutes = candidate.getMinutes() < 30 ? 0 : 30;
      candidate.setMinutes(roundedMinutes, 0, 0);
      if (candidate.getHours() < 8) return '09:00';
      return `${String(candidate.getHours()).padStart(2, '0')}:${String(candidate.getMinutes()).padStart(2, '0')}`;
    };

    // Check if we have existing users, if not create test ones
    let doctor = await Doctor.findOne().populate('user_id');
    let patient = await Patient.findOne().populate('user_id');

    if (!doctor) {
      console.log('Creating test doctor...');
      // Create test doctor user
      const doctorUser = new User({
        user_id: `TEST-DOCTOR-${Date.now()}`,
        full_name: 'Test Doctor',
        email: 'doctor@test.com',
        role: 'DOCTOR',
        password_hash: await bcrypt.hash('password123', 10),
        is_active: true,
        is_verified: true
      });
      await doctorUser.save();

      // Create doctor profile
      const doctorProfile = new Doctor({
        user_id: doctorUser._id,
        license_number: 'DOC123456',
        specialization: 'GENERAL',
        qualifications: 'MBBS',
        years_of_experience: 5,
        application_status: 'APPROVED'
      });
      await doctorProfile.save();
      doctor = doctorProfile;
      console.log('✅ Test doctor created');
    }

    if (!patient) {
      console.log('Creating test patient...');
      // Create test patient user
      const patientUser = new User({
        user_id: `TEST-PATIENT-${Date.now()}`,
        full_name: 'Test Patient',
        email: 'patient@test.com',
        role: 'PATIENT',
        password_hash: await bcrypt.hash('password123', 10),
        is_active: true,
        is_verified: true
      });
      await patientUser.save();

      // Create patient profile
      const patientProfile = new Patient({
        user_id: patientUser._id
      });
      await patientProfile.save();
      patient = patientProfile;
      console.log('✅ Test patient created');
    }

    console.log(`Using doctor: ${doctor.user_id.full_name}`);
    console.log(`Using patient: ${patient.user_id.full_name}`);

    await Appointment.deleteMany({
      reason: { $regex: /^Test Case:/i },
    });

    const testCases = [
      {
        reason: 'Test Case: Past Completed (with prescription)',
        appointment_date: dateWithOffset(-3),
        slot_start_time: '09:00',
        slot_end_time: addMinutesToTime('09:00', 30),
        appointment_type: 'ONLINE',
        status: 'COMPLETED',
        payment_status: 'PAID',
        payment_amount: 1000,
        completed_at: new Date(dateWithOffset(-3).getTime() + 30 * 60 * 1000),
        patient_attended: true,
        chat_enabled: true,
      },
      {
        reason: 'Test Case: Past No Show',
        appointment_date: dateWithOffset(-2),
        slot_start_time: '11:00',
        slot_end_time: addMinutesToTime('11:00', 30),
        appointment_type: 'OFFLINE',
        status: 'NO_SHOW',
        payment_status: 'PAID',
        payment_amount: 1000,
        patient_attended: false,
      },
      {
        reason: 'Test Case: Past Needs Action',
        appointment_date: dateWithOffset(-1),
        slot_start_time: '14:00',
        slot_end_time: addMinutesToTime('14:00', 30),
        appointment_type: 'OFFLINE',
        status: 'PAST',
        payment_status: 'PAID',
        payment_amount: 1000,
        patient_attended: false,
      },
      {
        reason: 'Test Case: Today Past Slot',
        appointment_date: dateWithOffset(0),
        slot_start_time: getSafePastTime(),
        slot_end_time: addMinutesToTime(getSafePastTime(), 30),
        appointment_type: 'ONLINE',
        status: 'PAST',
        payment_status: 'PAID',
        payment_amount: 1000,
        patient_attended: false,
      },
      {
        reason: 'Test Case: Upcoming Confirmed',
        appointment_date: dateWithOffset(2),
        slot_start_time: '10:30',
        slot_end_time: addMinutesToTime('10:30', 30),
        appointment_type: 'ONLINE',
        status: 'CONFIRMED',
        payment_status: 'PAID',
        payment_amount: 1000,
        patient_attended: true,
      },
      {
        reason: 'Test Case: Requested Future',
        appointment_date: dateWithOffset(4),
        slot_start_time: '12:00',
        slot_end_time: addMinutesToTime('12:00', 30),
        appointment_type: 'OFFLINE',
        status: 'REQUESTED',
        payment_status: 'PENDING',
        payment_amount: 1000,
      },
      {
        reason: 'Test Case: Reschedule Requested',
        appointment_date: dateWithOffset(5),
        slot_start_time: '13:00',
        slot_end_time: addMinutesToTime('13:00', 30),
        appointment_type: 'OFFLINE',
        status: 'RESCHEDULE_REQUESTED',
        reschedule_reason: 'Doctor unavailable',
        reschedule_requested_by: 'PATIENT',
        payment_status: 'PAID',
        payment_amount: 1000,
      },
      {
        reason: 'Test Case: Cancelled Future',
        appointment_date: dateWithOffset(6),
        slot_start_time: '15:00',
        slot_end_time: addMinutesToTime('15:00', 30),
        appointment_type: 'OFFLINE',
        status: 'CANCELLED',
        cancelled_by: 'PATIENT',
        cancellation_reason: 'Change of plans',
        cancelled_at: new Date(),
        payment_status: 'REFUNDED',
        payment_amount: 1000,
        refund_amount: 1000,
      },
    ];

    let createdCount = 0;

    for (const testCase of testCases) {
      const exists = await Appointment.findOne({
        patient_id: patient._id,
        doctor_id: doctor._id,
        reason: testCase.reason,
      });

      if (exists) {
        console.log(`⚠️  Skipping existing: ${testCase.reason}`);
        continue;
      }

      const appointment = await Appointment.create({
        patient_id: patient._id,
        doctor_id: doctor._id,
        ...testCase,
      });

      if (testCase.status === 'COMPLETED') {
        const prescription = await Prescription.create({
          appointment_id: appointment._id,
          patient_id: patient._id,
          doctor_id: doctor._id,
          medications: [
            {
              name: 'Amoxicillin',
              dosage: '500mg',
              frequency: 'Twice daily',
              duration: '7 days',
              instructions: 'Take with food',
            },
          ],
          notes: 'Follow up in 7 days. Monitor blood pressure regularly.',
        });
        appointment.prescription_id = prescription._id;
        await appointment.save();
      }

      createdCount += 1;
    }

    console.log(`✅ Successfully added ${createdCount} test appointments`);
    console.log('🔍 Test coverage includes: past completed, past no-show, past confirmed, today past slot, upcoming confirmed, requested, reschedule requested, cancelled.');

  } catch (error) {
    console.error('❌ Error adding test appointments:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
};

addTestAppointments();