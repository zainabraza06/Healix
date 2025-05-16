# Remote_HealthCare_Management_System
A Spring Boot-based web application for remote healthcare delivery, supporting Admin, Doctor, and Patient roles. Features include appointment booking, vitals tracking (via CSV), emergency alerts, PDF report generation, and real-time data visualization using Chart.js.
# 🩺 Remote Health Monitoring System (RHMS)

A comprehensive Spring Boot-based web application for remote health tracking, designed to facilitate efficient interaction between **Admins**, **Doctors**, and **Patients**. RHMS provides robust features like real-time vital monitoring, appointment scheduling, PDF report generation, email notifications, and emergency alert handling.

## 🚀 Features

### 🔐 Authentication & Roles
- Role-based access: `Admin`, `Doctor`, `Patient`
- Secure login and registration flows

### 👨‍⚕️ Doctor Dashboard
- Upload patient vitals via **CSV**
- View trends with **Chart.js** graphs
- Edit/download medical records (PDF)
- Book/reschedule/cancel appointments
- View and manage today's and upcoming appointments
- Trigger **Emergency Alerts**
- Respond to patient appointment, alert, and vital requests
- Add prescriptions and provide feedback

### 👤 Patient Dashboard
- Upload and track vitals
- View vitals in trend graphs (Chart.js)
- Book, reschedule, cancel appointments (online/in-person)
- Download their medical history
- Raise alerts
- Receive **email notifications** for appointments and alerts

### 🛡️ Admin Dashboard
- Add/activate/deactivate doctors
- Manage patient accounts
- View system logs
- Generate reports (PDF) for:
  - Appointments
  - Vitals
  - Alerts

---

## 📦 Tech Stack

| Layer        | Technology                  |
|--------------|-----------------------------|
| Backend      | Spring Boot (Java)          |
| Frontend     | Thymeleaf, HTML, JS, CSS    |
| Charts       | Chart.js                    |
| File Upload  | CSV (Apache Commons CSV)    |
| Reports      | PDF (iText or JasperReports)|
| Email        | Spring Boot Mail (SMTP)     |
| Database     | MySQL                       |
| Build Tool   | Maven                       |

---

## ⚙️ Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/zainabraza06/Remote_HealthCare_Management_System.git
   cd rhms
