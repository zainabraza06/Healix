import sql from '../config/db.js';

const createTables = async () => {
  console.log('Initializing database schema...');

  const queries = [
    // Users table
    `
    CREATE TABLE IF NOT EXISTS users (
      user_id VARCHAR(50) PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'DOCTOR', 'PATIENT')),
      password_hash TEXT NOT NULL,
      date_of_birth DATE,
      address TEXT,
      phone_number VARCHAR(20),
      gender VARCHAR(10) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
      blood_type VARCHAR(15) CHECK (blood_type IN (
        'A_POSITIVE', 'A_NEGATIVE', 'B_POSITIVE', 'B_NEGATIVE',
        'AB_POSITIVE', 'AB_NEGATIVE', 'O_POSITIVE', 'O_NEGATIVE', 'UNKNOWN'
      )),
      is_active BOOLEAN DEFAULT true,
      is_verified BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Patients table
    `
    CREATE TABLE IF NOT EXISTS patients (
      patient_id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
    );
    `,

    // Doctors table
    `
    CREATE TABLE IF NOT EXISTS doctors (
      doctor_id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
      license_number VARCHAR(100) UNIQUE NOT NULL,
      specialization VARCHAR(50) NOT NULL CHECK (specialization IN (
        'CARDIOLOGY', 'NEUROLOGY', 'ONCOLOGY', 'PEDIATRICS',
        'ORTHOPEDICS', 'DERMATOLOGY', 'PSYCHIATRY', 'GENERAL'
      )),
      application_status VARCHAR(20) DEFAULT 'PENDING' CHECK (application_status IN ('PENDING', 'APPROVED', 'REJECTED')),
      rejection_reason TEXT,
      approved_at TIMESTAMP,
      rejected_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Admins table
    `
    CREATE TABLE IF NOT EXISTS admins (
      admin_id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) UNIQUE REFERENCES users(user_id) ON DELETE CASCADE
    );
    `,

    // Verification tokens table
    `
    CREATE TABLE IF NOT EXISTS verification_tokens (
      id SERIAL PRIMARY KEY,
      token VARCHAR(255) UNIQUE NOT NULL,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Password reset tokens table
    `
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id SERIAL PRIMARY KEY,
      token VARCHAR(255) UNIQUE NOT NULL,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Appointments table
    `
    CREATE TABLE IF NOT EXISTS appointments (
      appointment_id SERIAL PRIMARY KEY,
      patient_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      doctor_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      appointment_date TIMESTAMP NOT NULL,
      appointment_type VARCHAR(20) CHECK (appointment_type IN ('ONLINE', 'IN_PERSON')),
      status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED')),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Vital signs table
    `
    CREATE TABLE IF NOT EXISTS vital_signs (
      vital_id SERIAL PRIMARY KEY,
      patient_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      heart_rate INTEGER,
      blood_pressure_systolic INTEGER,
      blood_pressure_diastolic INTEGER,
      temperature DECIMAL(5, 2),
      oxygen_saturation INTEGER,
      respiratory_rate INTEGER,
      weight DECIMAL(5, 2),
      height DECIMAL(5, 2),
      notes TEXT
    );
    `,

    // Alerts table
    `
    CREATE TABLE IF NOT EXISTS alerts (
      alert_id SERIAL PRIMARY KEY,
      patient_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      doctor_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      alert_type VARCHAR(20) CHECK (alert_type IN ('EMERGENCY', 'WARNING', 'INFO')),
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'RESOLVED')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    );
    `,

    // Medical records table
    `
    CREATE TABLE IF NOT EXISTS medical_records (
      record_id SERIAL PRIMARY KEY,
      patient_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      doctor_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      diagnosis TEXT,
      treatment TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Prescriptions table
    `
    CREATE TABLE IF NOT EXISTS prescriptions (
      prescription_id SERIAL PRIMARY KEY,
      patient_id VARCHAR(50) REFERENCES users(user_id) ON DELETE CASCADE,
      doctor_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      medication_name VARCHAR(255) NOT NULL,
      dosage VARCHAR(100),
      frequency VARCHAR(100),
      duration VARCHAR(100),
      instructions TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // System logs table
    `
    CREATE TABLE IF NOT EXISTS system_logs (
      log_id SERIAL PRIMARY KEY,
      user_id VARCHAR(50) REFERENCES users(user_id) ON DELETE SET NULL,
      action VARCHAR(255) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(50),
      details TEXT,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    `,

    // Create indexes for better performance
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`,
    `CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);`,
    `CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id);`,
    `CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);`,
    `CREATE INDEX IF NOT EXISTS idx_vital_signs_patient ON vital_signs(patient_id);`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_patient ON alerts(patient_id);`,
    `CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);`,
  ];

  try {
    for (const query of queries) {
      try {
        await sql.unsafe(query);
      } catch (error) {
        // Ignore errors about existing objects
        if (!error.message.includes('already exists')) {
          console.error('Error executing query:', error.message);
        }
      }
    }

    console.log('✅ Database schema initialized successfully!');
    console.log('\nTables created:');
    console.log('  • users');
    console.log('  • patients');
    console.log('  • doctors');
    console.log('  • admins');
    console.log('  • verification_tokens');
    console.log('  • password_reset_tokens');
    console.log('  • appointments');
    console.log('  • vital_signs');
    console.log('  • alerts');
    console.log('  • medical_records');
    console.log('  • prescriptions');
    console.log('  • system_logs');
    console.log('\nYou can now start the server with: npm start');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error.message);
    console.log('\nMake sure your DATABASE_URL is correct and the database is accessible.');
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createTables().then(() => process.exit(0));
}

export default createTables;
