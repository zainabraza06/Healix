# MVC Architecture Documentation

## Project Structure

The backend follows the **Model-View-Controller (MVC)** architecture pattern with an additional **Service Layer** for business logic.

```
backend-node/
├── src/
│   ├── models/           # Model Layer - Data access and database operations
│   ├── controllers/      # Controller Layer - Request/response handling
│   ├── services/         # Service Layer - Business logic and orchestration
│   ├── routes/           # Route definitions
│   ├── middleware/       # Custom middleware (auth, validation, error handling)
│   ├── config/           # Configuration files
│   ├── utils/            # Utility functions
│   ├── validators/       # Input validation schemas
│   ├── scripts/          # Database and utility scripts
│   └── server.js         # Application entry point
```

## Architecture Layers

### 1. **Model Layer** (`src/models/`)

Models handle all database operations and data access logic. They abstract the database queries and provide a clean interface for data manipulation.

**Key Responsibilities:**
- Database CRUD operations
- Data validation at the database level
- Query construction and execution
- Data transformation

**Files:**
- `User.js` - User data operations
- `Patient.js` - Patient-specific operations
- `Doctor.js` - Doctor-specific operations
- `Admin.js` - Admin-specific operations
- `VerificationToken.js` - Email verification tokens
- `PasswordResetToken.js` - Password reset tokens

**Example:**
```javascript
// User Model
class UserModel {
  async findById(userId) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }
  
  async create(userData) { /* ... */ }
  async update(userId, updates) { /* ... */ }
  async delete(userId) { /* ... */ }
}
```

### 2. **View Layer** (Response Formatting)

Since this is a RESTful API (not a traditional web app), we don't have HTML views. Instead, the "View" layer is represented by:
- Response formatting utilities (`src/utils/response.js`)
- JSON response structure
- HTTP status codes

**Example:**
```javascript
// Response utilities act as views
export const successResponse = (message, data = null) => {
  return {
    success: true,
    message,
    data
  };
};
```

### 3. **Controller Layer** (`src/controllers/`)

Controllers handle HTTP requests and responses. They orchestrate the flow between routes, services, and models.

**Key Responsibilities:**
- Receive and parse HTTP requests
- Call appropriate services/models
- Handle errors and edge cases
- Format and send HTTP responses
- Implement request validation

**Files:**
- `authController.js` - Authentication operations
- `adminController.js` - Admin operations

**Example:**
```javascript
class AuthController {
  async registerPatient(req, res, next) {
    try {
      const user = await authService.registerPatient(req.body);
      res.status(201).json(successResponse('Patient registered successfully.', user));
    } catch (error) {
      next(error);
    }
  }
}
```

### 4. **Service Layer** (`src/services/`)

Services contain business logic and orchestrate complex operations that involve multiple models or external services.

**Key Responsibilities:**
- Complex business logic
- Orchestration of multiple model operations
- Integration with external services (email, SMS, etc.)
- Transaction management
- Data transformation and validation

**Files:**
- `authService.js` - Authentication business logic
- `doctorService.js` - Doctor-related business logic
- `userService.js` - User management logic

**Example:**
```javascript
class AuthService {
  async registerDoctor(userData) {
    // Business logic: Check email uniqueness
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) throw new Error('Email already registered');
    
    // Create user via model
    const user = await UserModel.create(userDataObject);
    
    // Create doctor record via model
    await DoctorModel.create(doctorDataObject);
    
    // Send verification email (external service)
    await sendVerificationEmail(email, token);
    
    return user;
  }
}
```

### 5. **Routes** (`src/routes/`)

Routes map HTTP endpoints to controller methods and apply middleware.

**Files:**
- `authRoutes.js` - Authentication endpoints
- `adminRoutes.js` - Admin endpoints
- `index.js` - Route aggregation

**Example:**
```javascript
router.post('/register-patient', 
  registerPatientValidation,  // Middleware
  validate,                    // Middleware
  authController.registerPatient  // Controller method
);
```

### 6. **Middleware** (`src/middleware/`)

Middleware functions process requests before they reach controllers.

**Files:**
- `auth.js` - Authentication and authorization
- `validator.js` - Input validation
- `errorHandler.js` - Global error handling

## Request Flow

```
Client Request
    ↓
Route Definition (routes/)
    ↓
Middleware (middleware/)
    ├── Authentication
    ├── Validation
    └── Other middleware
    ↓
Controller (controllers/)
    ├── Parse request
    ├── Call service/model
    └── Format response
    ↓
Service (services/)
    ├── Business logic
    ├── Call multiple models
    └── External services
    ↓
Model (models/)
    ├── Database queries
    └── Data validation
    ↓
Database (Supabase)
    ↓
Response to Client
```

## Data Flow Example: User Registration

1. **Client** sends POST request to `/api/auth/register-patient`

2. **Route** (`authRoutes.js`) matches the endpoint and applies:
   - Validation middleware
   - Controller method

3. **Middleware** (`validators/authValidators.js`) validates input data

4. **Controller** (`authController.registerPatient`) receives the request:
   ```javascript
   async registerPatient(req, res, next) {
     const user = await authService.registerPatient(req.body);
     res.status(201).json(successResponse('...', user));
   }
   ```

5. **Service** (`authService.registerPatient`) handles business logic:
   - Checks if email exists (via UserModel)
   - Hashes password
   - Creates user (via UserModel)
   - Creates patient record (via PatientModel)
   - Returns user data

6. **Models** execute database operations:
   - `UserModel.findByEmail(email)` - Check uniqueness
   - `UserModel.create(userData)` - Insert user
   - `PatientModel.create(userId)` - Insert patient

7. **Controller** formats and sends response

## Best Practices

### Model Layer
- ✅ Keep models focused on data access
- ✅ Don't put business logic in models
- ✅ Return raw data, let services transform it
- ✅ Handle database errors gracefully

### Controller Layer
- ✅ Keep controllers thin
- ✅ Delegate to services for complex operations
- ✅ Handle errors with try-catch
- ✅ Use consistent response format

### Service Layer
- ✅ Implement business rules here
- ✅ Orchestrate multiple model calls
- ✅ Handle transactions
- ✅ Don't directly access HTTP request/response

## Adding New Features

### To add a new entity (e.g., Appointment):

1. **Create Model** (`src/models/Appointment.js`):
   ```javascript
   class AppointmentModel {
     async create(data) { /* ... */ }
     async findById(id) { /* ... */ }
     async findByPatient(patientId) { /* ... */ }
     // ... other CRUD operations
   }
   ```

2. **Create Service** (`src/services/appointmentService.js`):
   ```javascript
   class AppointmentService {
     async scheduleAppointment(data) {
       // Business logic
       // Validation
       // Call models
       // Send notifications
     }
   }
   ```

3. **Create Controller** (`src/controllers/appointmentController.js`):
   ```javascript
   class AppointmentController {
     async create(req, res, next) {
       const appointment = await appointmentService.scheduleAppointment(req.body);
       res.json(successResponse('...', appointment));
     }
   }
   ```

4. **Create Routes** (`src/routes/appointmentRoutes.js`):
   ```javascript
   router.post('/', authenticate, validate, appointmentController.create);
   ```

5. **Register Routes** in `src/routes/index.js`:
   ```javascript
   router.use('/appointments', appointmentRoutes);
   ```

## Testing Strategy

- **Unit Tests**: Test models, services, and utilities independently
- **Integration Tests**: Test controller + service + model together
- **E2E Tests**: Test full request/response cycle

## Benefits of MVC

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Maintainability**: Easy to locate and fix bugs
3. **Testability**: Each layer can be tested independently
4. **Scalability**: Easy to add new features without affecting existing code
5. **Reusability**: Services and models can be reused across controllers
6. **Team Collaboration**: Different team members can work on different layers

## Summary

This MVC architecture provides:
- **Models**: Data access and database operations
- **Views**: JSON response formatting (REST API)
- **Controllers**: Request handling and response formatting
- **Services**: Business logic orchestration
- **Clear separation** between layers
- **Easy to maintain** and extend
