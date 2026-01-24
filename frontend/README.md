# Next.js Frontend - Healthcare Management System

## Directory Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home page
│   │   ├── login/              # Login pages
│   │   ├── register/           # Registration pages
│   │   ├── patient/            # Patient pages
│   │   ├── doctor/             # Doctor pages
│   │   └── admin/              # Admin pages
│   ├── components/             # Reusable React components
│   ├── lib/                    # Utility libraries
│   │   ├── apiClient.ts        # API client
│   │   └── authStore.ts        # Zustand auth store
│   ├── types/                  # TypeScript types
│   └── globals.css             # Global styles
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
└── next.config.js
```

## Getting Started

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment

Update `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Build for Production

```bash
npm run build
npm start
```

## Project Structure

### Pages

- **Public Pages**
  - `/` - Home/Landing page
  - `/login` - Login page
  - `/register` - Registration page

- **Patient Pages** (`/patient`)
  - `/dashboard` - Patient dashboard
  - `/vitals` - Vital signs management
  - `/appointments` - Appointments
  - `/alerts` - Health alerts

- **Doctor Pages** (`/doctor`)
  - `/dashboard` - Doctor dashboard
  - `/patients` - Patient list
  - `/appointments` - Appointment management
  - `/alerts` - Patient alerts

- **Admin Pages** (`/admin`)
  - `/dashboard` - Admin dashboard
  - `/patients` - Manage patients
  - `/doctors` - Manage doctors
  - `/logs` - System logs

### Components

- **ProtectedLayout** - Route protection based on authentication
- **RootLayout** - Root layout wrapper with auth check
- **Navbar** - Navigation bar with role-based menu

### State Management

**Zustand Store (`authStore`)**
- Authentication state
- User information
- Token management
- Login/logout methods

### API Client

**API Client (`apiClient`)**
- All REST API calls
- Auth endpoints
- Patient endpoints
- Doctor endpoints
- Admin endpoints
- Automatic token injection
- Error handling

### Styling

- **Tailwind CSS** - Utility-first CSS framework
- **Global CSS** - Custom utilities and components
- **Responsive Design** - Mobile-first approach

## Features Implemented

### ✅ Authentication
- Login page with form validation
- JWT token management
- Protected routes
- Role-based access control
- Automatic logout on token expiration

### ✅ Dashboards
- Patient dashboard with vital stats
- Doctor dashboard with appointments
- Admin dashboard with system stats

### ✅ Navigation
- Role-based navbar
- Mobile-responsive menu
- Active page highlighting
- Quick action buttons

### ✅ API Integration
- Axios-based API client
- Automatic token injection
- Error handling
- Response formatting

### ✅ UI/UX
- Clean, modern design
- Tailwind CSS styling
- Loading states
- Error messages
- Toast notifications

## Development Guide

### Adding New Pages

```typescript
// src/app/[role]/[feature]/page.tsx
'use client';

import ProtectedLayout from '@/components/ProtectedLayout';
import RootLayout from '@/components/RootLayout';

export default function FeaturePage() {
  return (
    <ProtectedLayout allowedRoles={['ROLE']}>
      <RootLayout>
        {/* Your content */}
      </RootLayout>
    </ProtectedLayout>
  );
}
```

### Using API Client

```typescript
import { apiClient } from '@/lib/apiClient';

// In a component or server action
const response = await apiClient.getPatientDashboard();
if (response.success) {
  // Handle success
} else {
  // Handle error
}
```

### Using Auth Store

```typescript
import { useAuthStore } from '@/lib/authStore';

export default function MyComponent() {
  const { user, token, login, logout } = useAuthStore();
  
  // Use store methods and state
}
```

### Adding New API Endpoint

```typescript
// 1. Add type in src/types/index.ts
export interface NewData {
  // fields
}

// 2. Add method to apiClient
async getNewData(): Promise<ApiResponse<NewData>> {
  const response = await this.client.get('/endpoint');
  return response.data;
}

// 3. Use in component
const response = await apiClient.getNewData();
```

## Styling Guide

### CSS Classes Available

```css
/* Components */
.card              /* Card/box styling */
.btn-primary       /* Primary button */
.btn-secondary     /* Secondary button */
.input-field       /* Input field styling */

/* Text Utilities */
.text-error        /* Error text */
.text-success      /* Success text */

/* Layout */
.container-main    /* Main container */
```

### Tailwind Colors

```css
primary-50 to primary-900    /* Blue color palette */
success: #10b981
warning: #f59e0b
error: #ef4444
```

## Performance Optimization

- Code splitting with Next.js
- Image optimization
- Static generation where possible
- Client-side caching with Zustand

## Security Best Practices

- JWT token stored in localStorage
- Automatic logout on token expiration
- Protected API endpoints
- Role-based access control
- HTTPS in production
- Secure HTTP-only cookies (optional)

## Troubleshooting

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` in `.env.local`
- Check backend is running on correct port
- Verify CORS is enabled on backend
- Check browser console for detailed errors

### Authentication Issues
- Clear localStorage and refresh page
- Verify token in browser DevTools
- Check token expiration time
- Try login again

### Styling Issues
- Verify Tailwind CSS is working
- Clear Next.js cache: `rm -rf .next`
- Rebuild: `npm run build`

### Build Issues
- Clear node_modules: `rm -rf node_modules`
- Reinstall: `npm install`
- Check TypeScript errors: `npm run type-check`

## Testing

### Manual Testing Checklist

- [ ] Login works with correct credentials
- [ ] Login fails with incorrect credentials
- [ ] Session persists on page reload
- [ ] Logout works correctly
- [ ] Role-based routing works
- [ ] Navbar shows correct menu for role
- [ ] Dashboard loads data correctly
- [ ] Mobile responsive design works
- [ ] Error messages display properly
- [ ] API calls include token

### Testing with Demo Credentials

```
Patient: patient@example.com / password123
Doctor: doctor@example.com / password123
Admin: admin@example.com / password123
```

## Next Steps

1. **Complete Remaining Pages**
   - Patient vitals upload
   - Appointment booking
   - Doctor patient management
   - Admin user management

2. **Add Advanced Features**
   - Real-time notifications
   - File uploads
   - Search and filtering
   - Pagination
   - Date pickers

3. **Enhance UX**
   - Loading skeletons
   - Animated transitions
   - Dark mode support
   - Accessibility features

4. **Deployment**
   - Environment configuration
   - Build optimization
   - Deployment to Vercel or similar
   - CI/CD pipeline setup

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run type-check       # Check TypeScript

# Cleanup
rm -rf .next            # Clear Next.js cache
rm -rf node_modules     # Clear dependencies
```

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Zustand GitHub](https://github.com/pmndrs/zustand)
- [Axios Documentation](https://axios-http.com/docs/intro)

## Support

For issues or questions:
1. Check documentation files
2. Review error messages in browser console
3. Verify API connectivity
4. Check component implementation
5. Review state management logic

---

**Project Version:** 1.0.0  
**Created:** January 17, 2026
