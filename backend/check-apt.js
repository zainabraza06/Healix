import connectDB from './src/config/db.js';
import Appointment from './src/models/Appointment.js';

async function main() {
    await connectDB();
    
    // Get all REQUESTED appointments
    const requestedApts = await Appointment.find({ status: 'REQUESTED' }).lean();
    console.log('\n=== REQUESTED Appointments ===');
    console.log('Count:', requestedApts.length);
    requestedApts.forEach(a => {
        console.log(`ID: ${a._id}, Status: ${a.status}, Payment: ${a.payment_status}, Date: ${a.appointment_date}`);
    });
    
    // Check specific appointment
    const apt = await Appointment.findById('697f03455dbe7326da26b17c').lean();
    console.log('\n=== Specific Appointment 697f03455dbe7326da26b17c ===');
    if (apt) {
        console.log(`Status: ${apt.status}, Payment: ${apt.payment_status}, Date: ${apt.appointment_date}`);
    } else {
        console.log('Not found');
    }
    
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
