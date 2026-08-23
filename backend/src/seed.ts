import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User, { UserRole } from './models/User';
import Complaint, { ComplaintStatus, ComplaintCategory, ComplaintPriority } from './models/Complaint';
import Counter from './models/Counter';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/civic-issue-reporting';

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB for seeding');

    // Check if demo user exists
    const existingUser = await User.findOne({ email: 'citizen@civic.local' });
    if (existingUser) {
      console.log('⚠️  Demo data already exists. Skipping seed.');
      await mongoose.disconnect();
      return;
    }

    // Create demo citizen
    const demoCitizen = await User.create({
      name: 'Demo Citizen',
      email: 'citizen@civic.local',
      phone: '9876543210',
      password: 'Staff@123',
      role: UserRole.CITIZEN,
    });
    console.log('✅ Created demo citizen: citizen@civic.local / Staff@123');

    // Initialize counter
    await Counter.findOneAndUpdate(
      { name: 'complaintId' },
      { seq: 10005 },
      { upsert: true }
    );

    // Create sample complaints
    const sampleComplaints = [
      {
        complaintId: 'CIV-10001',
        citizenId: demoCitizen._id,
        category: ComplaintCategory.POTHOLE,
        description: 'Large pothole near the main road junction causing traffic disruption. Multiple vehicles have been damaged. The pothole is approximately 2 feet deep and 3 feet wide.',
        images: [],
        latitude: 28.7041,
        longitude: 77.1025,
        address: 'Sector 18, Noida, Delhi NCR',
        status: ComplaintStatus.SUBMITTED,
        priority: ComplaintPriority.MEDIUM,
        department: 'Roads Department',
        createdAt: new Date('2026-08-18'),
      },
      {
        complaintId: 'CIV-10002',
        citizenId: demoCitizen._id,
        category: ComplaintCategory.BROKEN_STREETLIGHT,
        description: 'Three streetlights on the main avenue have been non-functional for over a week. The area becomes dangerously dark after 7 PM, making it unsafe for pedestrians.',
        images: [],
        latitude: 28.6139,
        longitude: 77.2090,
        address: 'Ward 12, Connaught Place, New Delhi',
        status: ComplaintStatus.IN_PROGRESS,
        priority: ComplaintPriority.MEDIUM,
        department: 'Electrical Department',
        createdAt: new Date('2026-08-15'),
      },
      {
        complaintId: 'CIV-10003',
        citizenId: demoCitizen._id,
        category: ComplaintCategory.GARBAGE,
        description: 'Garbage has been piling up at the community bin for days. The waste is overflowing onto the street and causing a terrible smell. Needs immediate collection.',
        images: [],
        latitude: 28.6304,
        longitude: 77.2177,
        address: 'Central Market, Lajpat Nagar, New Delhi',
        status: ComplaintStatus.RESOLVED,
        priority: ComplaintPriority.LOW,
        department: 'Sanitation Department',
        createdAt: new Date('2026-08-10'),
      },
      {
        complaintId: 'CIV-10004',
        citizenId: demoCitizen._id,
        category: ComplaintCategory.DRAINAGE,
        description: 'Blocked drainage causing waterlogging during recent rains. Sewage water is backing up into the street. Health hazard for nearby residents.',
        images: [],
        latitude: 28.5355,
        longitude: 77.3910,
        address: 'Sector 62, Noida, UP',
        status: ComplaintStatus.ASSIGNED,
        priority: ComplaintPriority.HIGH,
        department: 'Drainage Department',
        createdAt: new Date('2026-08-20'),
      },
      {
        complaintId: 'CIV-10005',
        citizenId: demoCitizen._id,
        category: ComplaintCategory.WATER_ISSUE,
        description: 'Water pipeline burst near the park. Clean water is being wasted and the area is flooded. The leak started two days ago and no one has come to fix it.',
        images: [],
        latitude: 28.4595,
        longitude: 77.0266,
        address: 'DLF Phase 3, Gurugram, Haryana',
        status: ComplaintStatus.UNDER_REVIEW,
        priority: ComplaintPriority.HIGH,
        department: 'Water Supply Department',
        createdAt: new Date('2026-08-21'),
      },
    ];

    await Complaint.insertMany(sampleComplaints);
    console.log(`✅ Created ${sampleComplaints.length} sample complaints`);

    console.log('\n🎉 Database seeded successfully!\n');
    console.log('Demo Login:');
    console.log('  Email:    citizen@civic.local');
    console.log('  Password: Staff@123\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedData();
