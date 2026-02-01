<p align="center">
  <img src="https://img.shields.io/badge/MERN-Stack-green?style=for-the-badge" alt="MERN Stack"/>
  <img src="https://img.shields.io/badge/License-ISC-blue?style=for-the-badge" alt="License"/>
  <img src="https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"/>
</p>

# 🏥 Healix - Remote Healthcare Management System

A comprehensive, full-stack telemedicine platform that enables seamless healthcare delivery through virtual consultations, appointment management, real-time communication, and patient health monitoring.

## ✨ Features

### 👨‍⚕️ For Doctors
- **Dashboard** - Overview of appointments, patient alerts, and daily schedule
- **Appointment Management** - View, confirm, reschedule, and complete appointments
- **Patient Management** - Access patient profiles, medical history, and vitals
- **Real-time Chat** - Communicate with patients before/after appointments
- **Prescription Management** - Create and manage prescriptions
- **Emergency Alerts** - Receive and respond to patient health alerts
- **Status Management** - Request activation/deactivation with admin approval

### 👤 For Patients
- **Dashboard** - View upcoming appointments and health summary
- **Doctor Search & Booking** - Find doctors and book online/offline appointments
- **Vitals Tracking** - Upload and monitor health vitals (CSV upload supported)
- **Medical Records** - Access complete medical history and prescriptions
- **Real-time Chat** - Chat with assigned doctors
- **Emergency Alerts** - Send emergency alerts to doctors
- **Online Payments** - Secure payment processing via Stripe
- **Appointment Rescheduling** - Request appointment changes

### 🔐 For Admins
- **Dashboard** - System-wide analytics and statistics
- **Doctor Applications** - Review and approve/reject doctor registrations
- **User Management** - Manage all doctors and patients
- **Appointment Oversight** - View and manage all appointments
- **Emergency Request Review** - Handle emergency cancellation requests
- **System Logs** - Monitor all system activities
- **Alert Management** - Create and manage system-wide alerts

### 🔧 System Features
- **JWT Authentication** - Secure token-based authentication with refresh tokens
- **Role-Based Access Control** - Admin, Doctor, and Patient roles
- **Email Notifications** - Automated emails for verification, appointments, and alerts
- **Real-time Updates** - Socket.IO for live notifications and chat
- **Responsive Design** - Works seamlessly on desktop and mobile
- **3D Animated UI** - Beautiful Three.js powered backgrounds
- **Dark Mode** - Modern dark-themed interface

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Smooth animations |
| **React Three Fiber** | 3D backgrounds and effects |
| **Socket.IO Client** | Real-time communication |
| **Zustand** | State management |
| **Recharts** | Data visualization |
| **Stripe.js** | Payment processing |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Express.js** | Web framework |
| **MongoDB** | NoSQL database |
| **Mongoose** | MongoDB ODM |
| **Socket.IO** | WebSocket server |
| **JWT** | Authentication tokens |
| **Nodemailer** | Email service |
| **Stripe** | Payment processing |
| **PDFKit** | PDF generation |
| **Node-cron** | Scheduled tasks |

## 📁 Project Structure

```
Remote_HealthCare_Management_System/
├── backend/
│   └── src/
│       ├── config/          # Database, JWT, Socket, Email config
│       ├── controllers/     # Route controllers
│       ├── middleware/      # Auth, validation, error handling
│       ├── models/          # Mongoose schemas
│       ├── routes/          # API route definitions
│       ├── services/        # Business logic layer
│       ├── utils/           # Helper functions
│       ├── validators/      # Input validation schemas
│       ├── scripts/         # Database initialization
│       └── server.js        # Application entry point
│
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       │   ├── admin/       # Admin dashboard & pages
│       │   ├── doctor/      # Doctor dashboard & pages
│       │   ├── patient/     # Patient dashboard & pages
│       │   ├── login/       # Authentication pages
│       │   └── register/    # Registration pages
│       ├── components/      # Reusable UI components
│       ├── hooks/           # Custom React hooks
│       ├── lib/             # API client & utilities
│       └── types/           # TypeScript type definitions
│
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18.0 or higher
- **MongoDB** (local or Atlas)
- **npm** or **yarn**
- **Stripe Account** (for payments)
- **Gmail Account** (for email notifications)

### Environment Variables

#### Backend (.env)
```env
# Server
PORT=8080
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/healix

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:8080
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/zainabraza06/Remote_HealthCare_Management_System.git
   cd Remote_HealthCare_Management_System
   ```

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Initialize Database**
   ```bash
   cd ../backend
   npm run init-db
   ```

5. **Start Development Servers**

   Backend (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```

   Frontend (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register-patient` | Register new patient |
| POST | `/api/auth/register-doctor` | Register new doctor |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/refresh-token` | Refresh JWT token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/verify-email` | Verify email address |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |

### Patient Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patient/dashboard` | Get patient dashboard |
| GET | `/api/patient/doctors` | List available doctors |
| POST | `/api/patient/appointments` | Book appointment |
| GET | `/api/patient/vitals` | Get vitals history |
| POST | `/api/patient/vitals/upload` | Upload vitals CSV |
| POST | `/api/patient/alerts` | Send emergency alert |

### Doctor Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/doctor/dashboard` | Get doctor dashboard |
| GET | `/api/doctor/patients` | List assigned patients |
| PUT | `/api/doctor/appointments/:id/confirm` | Confirm appointment |
| POST | `/api/doctor/appointments/:id/complete` | Complete appointment |
| GET | `/api/doctor/alerts` | Get patient alerts |
| PUT | `/api/doctor/alerts/:id/resolve` | Resolve alert |

### Admin Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Get admin dashboard |
| GET | `/api/admin/pending-doctors` | List pending applications |
| PUT | `/api/admin/doctors/:id/approve` | Approve doctor |
| PUT | `/api/admin/doctors/:id/reject` | Reject doctor |
| GET | `/api/admin/appointments` | List all appointments |
| GET | `/api/admin/logs` | Get system logs |

### Chat Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/patient/:doctorId/history` | Get chat history (patient) |
| GET | `/api/chat/doctor/:patientId/history` | Get chat history (doctor) |
| POST | `/api/chat/send` | Send message |

## 🔒 Security Features

- **Password Hashing** - bcrypt with salt rounds
- **JWT Tokens** - Short-lived access tokens with refresh token rotation
- **HTTP-Only Cookies** - Secure token storage
- **CORS Configuration** - Restricted origins
- **Input Validation** - Express-validator for all inputs
- **Rate Limiting** - Protection against brute force
- **Role-Based Access** - Middleware-enforced permissions

## 📊 Database Schema

### Core Collections
- **Users** - Authentication and profile data
- **Patients** - Patient-specific information
- **Doctors** - Doctor profiles and specializations
- **Admins** - Admin accounts
- **Appointments** - Booking and scheduling
- **Prescriptions** - Medical prescriptions
- **Medical Records** - Patient health history
- **Vitals** - Patient vital signs
- **Alerts** - Emergency health alerts
- **Messages** - Chat messages
- **Payments** - Transaction records
- **Logs** - System activity logs

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request



## 👨‍💻 Author

**Your Name**
- GitHub: [@zainabraza06](https://github.com/yourusername)
- LinkedIn: [Zainab Raza Malik](www.linkedin.com/in/zainab-raza-malik-9b9a42219)

## 🙏 Acknowledgments

- [Next.js Documentation](https://nextjs.org/docs)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Stripe Documentation](https://stripe.com/docs)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)

---

<p align="center">
  Made with ❤️ for better healthcare accessibility
</p>
