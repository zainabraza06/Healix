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

    // Create two past appointments (before current date)
    const pastDate1 = new Date('2025-01-15'); // January 15, 2025
    const pastDate2 = new Date('2025-01-20'); // January 20, 2025

    // Check if we have existing users, if not create test ones
    let doctor = await Doctor.findOne().populate('user_id');
    let patient = await Patient.findOne().populate('user_id');

    if (!doctor) {
      console.log('Creating test doctor...');
      // Create test doctor user
      const doctorUser = new User({
        first_name: 'Test',
        last_name: 'Doctor',
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
        first_name: 'Test',
        last_name: 'Patient',
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

    console.log(`Using doctor: ${doctor.user_id.first_name} ${doctor.user_id.last_name}`);
    console.log(`Using patient: ${patient.user_id.first_name} ${patient.user_id.last_name}`);

    // Check if test appointments already exist
    const existingCompleted = await Appointment.countDocuments({
      patient_id: patient._id,
      doctor_id: doctor._id,
      reason: 'Regular checkup - Test Appointment 1',
      status: 'COMPLETED'
    });

    const existingConfirmed = await Appointment.countDocuments({
      patient_id: patient._id,
      doctor_id: doctor._id,
      reason: 'Follow-up consultation - Test Appointment 2',
      status: 'CONFIRMED'
    });

    if (existingCompleted > 0 && existingConfirmed > 0) {
      console.log(`⚠️  Test appointments already exist. Skipping creation.`);
      console.log('   To recreate, delete existing test appointments first.');
      return;
    }

    // Create appointments that don't exist yet
    const appointmentsToCreate = [];

    if (existingCompleted === 0) {
      appointmentsToCreate.push({
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
    }

    if (existingConfirmed === 0) {
      appointmentsToCreate.push({
        patient_id: patient._id,
        doctor_id: doctor._id,
        appointment_date: pastDate2,
        slot_start_time: '14:00',
        slot_end_time: '14:30',
        appointment_type: 'OFFLINE',
        status: 'CONFIRMED',
        reason: 'Follow-up consultation - Test Appointment 2',
        payment_status: 'PAID',
        payment_amount: 1000,
        patient_attended: false,
        chat_enabled: false
      });
    }

    // Create the appointments
    for (const aptData of appointmentsToCreate) {
      const appointment = new Appointment(aptData);
      await appointment.save();

      // Create prescription for COMPLETED appointments
      if (aptData.status === 'COMPLETED') {
        const prescription = new Prescription({
          appointment_id: appointment._id,
          medications: [
            {
              name: 'Test Medication',
              dosage: '500mg',
              frequency: 'Twice daily',
              duration: '7 days',
              instructions: 'Take with food'
            }
          ],
          notes: 'Follow up in 7 days. Monitor blood pressure regularly.'
        });
        await prescription.save();

        // Update appointment with prescription reference
        appointment.prescription_id = prescription._id;
        await appointment.save();
      }
    }

    console.log(`✅ Successfully added ${appointmentsToCreate.length} test past appointments`);
    if (appointmentsToCreate.length > 0) {
      console.log(`📅 Appointment 1: ${pastDate1.toDateString()} at 10:00 - COMPLETED (with prescription)`);
      console.log(`📅 Appointment 2: ${pastDate2.toDateString()} at 14:00 - CONFIRMED (shows Complete/No Show buttons)`);
      console.log('\n🔍 You can now test the past appointments functionality in the application.');
      console.log('   - Appointment 1 will show prescription details');
      console.log('   - Appointment 2 will show Complete/No Show buttons');
    }

  } catch (error) {
    console.error('❌ Error adding test appointments:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  }
};

addTestAppointments();