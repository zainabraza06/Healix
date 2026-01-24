# Remote Healthcare Management System - Node.js Backend

A comprehensive healthcare management system built with Node.js, Express, and Supabase.

## Features

- **Authentication & Authorization**: JWT-based auth with role-based access control (Admin, Doctor, Patient)
- **User Management**: Registration, login, email verification, password reset
- **Appointments**: Book, reschedule, cancel appointments
- **Vitals Tracking**: Upload and monitor patient vitals
- **Alerts**: Emergency alert system
- **Email Notifications**: Automated email notifications for appointments and alerts
- **Medical Records**: Manage patient medical history
- **Prescriptions**: Doctor prescriptions management

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + Supabase Auth
- **Email**: Nodemailer
- **Validation**: Express Validator

## Setup Instructions

### Prerequisites

- Node.js 18+ installed
- Supabase account
- Gmail account for email notifications (or other SMTP service)

### Installation

1. **Clone the repository**
   ```bash
   cd backend-node
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in your actual values:
   - Get Supabase credentials from your Supabase project settings
   - Generate JWT secrets (use a random string generator)
   - Configure email settings

4. **Initialize the database**
   ```bash
   npm run init-db
   ```
   
   This will create all necessary tables in your Supabase database.

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

The server will start on `http://localhost:8080`

## API Endpoints

### Authentication
- `POST /api/auth/register-patient` - Register a new patient
- `POST /api/auth/register-doctor` - Register a new doctor
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh-token` - Refresh JWT token
- `GET /api/auth/validate-token` - Validate token
- `GET /api/auth/me` - Get current user
- `GET /api/auth/verify-email` - Verify email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password

### Admin
- `POST /api/admin/register-admin` - Register admin (one-time)
- `GET /api/admin/applications/pending` - Get pending doctor applications
- `POST /api/admin/applications/approve` - Approve doctor application
- `POST /api/admin/applications/reject` - Reject doctor application

### More endpoints documented in the API reference...

## Project Structure

```
backend-node/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Custom middleware
│   ├── models/          # Data models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   ├── validators/      # Input validation
│   ├── scripts/         # Database scripts
│   └── server.js        # Entry point
├── .env                 # Environment variables
├── .env.example         # Environment template
├── package.json         # Dependencies
└── README.md           # This file
```

## Database Schema

The application uses the following main tables:
- `users` - Base user information
- `patients` - Patient-specific data
- `doctors` - Doctor-specific data
- `admins` - Admin-specific data
- `appointments` - Appointment records
- `vital_signs` - Patient vitals
- `alerts` - Emergency alerts
- `medical_records` - Medical history
- `prescriptions` - Doctor prescriptions
- `verification_tokens` - Email verification
- `password_reset_tokens` - Password reset tokens
- `system_logs` - System activity logs

## License

ISC
