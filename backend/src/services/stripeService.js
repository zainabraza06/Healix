import Stripe from 'stripe';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import Patient from '../models/Patient.js';

// Initialize Stripe with secret key
// Use test key for demo: sk_test_... (set in .env)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_demo');

const APPOINTMENT_FEE = 1000; // PKR - will be converted to smallest unit
const CURRENCY = 'pkr';

/**
 * Create a Stripe Checkout Session for appointment payment
 */
export const createCheckoutSession = async (appointmentId, patientId) => {
    const appointment = await Appointment.findById(appointmentId)
        .populate({ path: 'doctor_id', populate: { path: 'user_id' } })
        .populate({ path: 'patient_id', populate: { path: 'user_id' } });

    if (!appointment) {
        const err = new Error('Appointment not found');
        err.statusCode = 404;
        throw err;
    }

    if (appointment.patient_id._id.toString() !== patientId.toString()) {
        const err = new Error('Unauthorized');
        err.statusCode = 403;
        throw err;
    }

    if (appointment.status !== 'CONFIRMED') {
        const err = new Error('Appointment must be confirmed before payment');
        err.statusCode = 400;
        throw err;
    }

    if (appointment.payment_status === 'PAID') {
        const err = new Error('Payment already completed');
        err.statusCode = 400;
        throw err;
    }

    const doctorName = appointment.doctor_id.user_id?.full_name || 'Doctor';
    const appointmentDate = new Date(appointment.appointment_date).toLocaleDateString();

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: [
            {
                price_data: {
                    currency: CURRENCY,
                    product_data: {
                        name: `Medical Consultation - Dr. ${doctorName}`,
                        description: `Appointment on ${appointmentDate} at ${appointment.slot_start_time}`,
                    },
                    unit_amount: APPOINTMENT_FEE * 100, // Stripe uses smallest currency unit (paisa for PKR)
                },
                quantity: 1,
            },
        ],
        metadata: {
            appointmentId: appointmentId.toString(),
            patientId: patientId.toString(),
        },
        success_url: `${process.env.FRONTEND_URL}/patient/appointments?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/patient/appointments?payment=cancelled`,
    });

    // Store session ID in appointment for verification
    appointment.stripe_session_id = session.id;
    await appointment.save();

    return {
        sessionId: session.id,
        url: session.url,
    };
};

/**
 * Verify payment status from Stripe session
 */
export const verifyPayment = async (sessionId) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
        return { success: false, status: session.payment_status };
    }

    const appointmentId = session.metadata.appointmentId;
    const patientId = session.metadata.patientId;

    const appointment = await Appointment.findById(appointmentId);

    if (!appointment) {
        throw new Error('Appointment not found');
    }

    // Already processed
    if (appointment.payment_status === 'PAID') {
        return { success: true, alreadyProcessed: true };
    }

    // Update appointment
    appointment.payment_status = 'PAID';
    appointment.paid_at = new Date();
    appointment.stripe_payment_id = session.payment_intent;
    await appointment.save();

    // Create payment record
    await Payment.create({
        appointment_id: appointmentId,
        patient_id: patientId,
        amount: APPOINTMENT_FEE,
        type: 'PAYMENT',
        status: 'COMPLETED',
        challan_number: `STRIPE-${session.payment_intent}`,
        transaction_date: new Date(),
    });

    return { success: true, appointment };
};

/**
 * Handle Stripe webhook events
 */
export const handleWebhook = async (payload, signature) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
        throw new Error(`Webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            await verifyPayment(session.id);
            break;
        }
        case 'payment_intent.succeeded': {
            console.log('Payment succeeded:', event.data.object.id);
            break;
        }
        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
};

/**
 * Create refund for cancelled appointment
 */
export const createRefund = async (appointmentId, amount, reason) => {
    const appointment = await Appointment.findById(appointmentId);

    if (!appointment || !appointment.stripe_payment_id) {
        // No Stripe payment to refund
        return null;
    }

    const refund = await stripe.refunds.create({
        payment_intent: appointment.stripe_payment_id,
        amount: amount * 100, // Convert to paisa
        reason: 'requested_by_customer',
        metadata: {
            appointmentId: appointmentId.toString(),
            originalReason: reason,
        },
    });

    return refund;
};

export default {
    createCheckoutSession,
    verifyPayment,
    handleWebhook,
    createRefund,
};
