import dotenv from 'dotenv';
import dns from 'dns';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import User from '../models/User.js';
import Admin from '../models/Admin.js';

dotenv.config();
dns.setServers(['8.8.8.8', '8.8.4.4']);

const seedAdmin = async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  console.log('✅ Connected to MongoDB');

  const email = 'admin@healix.com';
  const password = 'Admin@123456';

  const existing = await User.findOne({ email });
  if (existing) {
    console.log('⚠️  Admin already exists:', email);
    await mongoose.disconnect();
    return;
  }

  const password_hash = await bcrypt.hash(password, 12);
  const user = await User.create({
    user_id: uuidv4(),
    email,
    password_hash,
    full_name: 'Super Admin',
    role: 'ADMIN',
    is_active: true,
    is_verified: true,
  });

  await Admin.create({ user_id: user._id });

  console.log('✅ Admin seeded successfully');
  console.log('   Email   :', email);
  console.log('   Password:', password);
  await mongoose.disconnect();
};

seedAdmin().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
