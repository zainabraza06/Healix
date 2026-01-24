# MongoDB Atlas Cloud Setup Guide

## Step-by-Step Instructions

### 1. Create MongoDB Atlas Account
- Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- Sign up with your email or Google/GitHub account
- Verify your email

### 2. Create a Cluster
- Click "Create Deployment"
- Select **M0 Free Tier** (perfect for development)
- Choose your preferred region
- Click "Create Deployment"
- Wait 2-3 minutes for the cluster to be ready

### 3. Create a Database User
- In MongoDB Atlas, go to "Security" → "Database Access"
- Click "Add Database User"
- Create username and password (save these securely)
- Set permissions to "Atlas Admin"
- Click "Create User"

### 4. Whitelist Your IP
- Go to "Security" → "Network Access"
- Click "Add IP Address"
- Select "Add Current IP Address" OR
- For development, select "Allow access from anywhere" (0.0.0.0/0)
- Click "Confirm"

### 5. Get Connection String
- Click "Databases" in the left menu
- Click "Connect" on your cluster
- Select "Connect your application"
- Choose "Node.js" driver
- Copy the connection string

### 6. Update Your .env File
Replace the DATABASE_URL in `.env` with your MongoDB Atlas connection string:

```
DATABASE_URL=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.mongodb.net/healthcare?retryWrites=true&w=majority
```

**Important:** Replace:
- `YOUR_USERNAME` - your database user username
- `YOUR_PASSWORD` - your database user password (URL encode special characters)

### Example Connection String
```
mongodb+srv://admin:myPassword123@cluster0.yzabc.mongodb.net/healthcare?retryWrites=true&w=majority
```

### 7. URL Encode Special Characters (if needed)
If your password contains special characters like `@`, `#`, `!`, etc., use:
- `@` → `%40`
- `#` → `%23`
- `!` → `%21`
- `:` → `%3A`

Or visit [URL Encoder](https://www.urlencoder.org/)

### 8. Test Connection
After updating `.env`, start your backend:
```bash
cd backend
npm run dev
```

You should see in console:
```
✅ MongoDB Connected: mongodb+srv://...
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Authentication failed" | Check username/password are correct |
| "IP address not allowed" | Whitelist your IP in Network Access |
| "Cluster not found" | Wait for cluster to finish initializing |
| "Connection timeout" | Check internet connection and firewall |

## Security Notes
- Never commit `.env` file to git
- Change `YOUR_PASSWORD` in production
- Use environment-specific credentials
- Rotate credentials regularly

## Production Recommendations
- Use M2+ tier for production
- Enable backups
- Use IP whitelisting instead of 0.0.0.0/0
- Implement automated backups
- Monitor connection metrics
