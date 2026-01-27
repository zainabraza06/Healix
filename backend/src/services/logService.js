import Log from '../models/Log.js';

/**
 * Create a log entry in the database
 */
export const createLog = async (logData) => {
  try {
    const log = await Log.create({
      user_id: logData.userId,
      admin_id: logData.adminId,
      level: logData.level || 'INFO',
      action: logData.action,
      entity_type: logData.entityType,
      entity_id: logData.entityId,
      description: logData.description,
      ip_address: logData.ipAddress,
      status: logData.status || 'SUCCESS',
      error_details: logData.errorDetails,
    });
    console.log(`[LOG] ${logData.action} - ${logData.description}`);
    return log;
  } catch (error) {
    console.error('Failed to create log:', error.message);
  }
};

/**
 * Log authentication activities
 */
export const logAuthActivity = async (userId, action, status, ipAddress, errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'USER',
    entityId: userId,
    description: `${action} - ${status}`,
    ipAddress,
    status,
    errorDetails,
  });
};

/**
 * Log patient activities
 */
export const logPatientActivity = async (userId, action, patientId, description, status = 'SUCCESS', errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'PATIENT',
    entityId: patientId,
    description,
    status,
    errorDetails,
  });
};

/**
 * Log doctor activities
 */
export const logDoctorActivity = async (userId, action, doctorId, description, status = 'SUCCESS', errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'DOCTOR',
    entityId: doctorId,
    description,
    status,
    errorDetails,
  });
};

/**
 * Log appointment activities
 */
export const logAppointmentActivity = async (userId, action, appointmentId, description, status = 'SUCCESS', errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'APPOINTMENT',
    entityId: appointmentId,
    description,
    status,
    errorDetails,
  });
};

/**
 * Log alert activities
 */
export const logAlertActivity = async (userId, action, alertId, description, status = 'SUCCESS', errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'ALERT',
    entityId: alertId,
    description,
    status,
    errorDetails,
  });
};

/**
 * Log message/chat activities
 */
export const logMessageActivity = async (userId, action, description, status = 'SUCCESS', errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'SYSTEM',
    description,
    status,
    errorDetails,
  });
};

/**
 * Log vital sign upload/recording
 */
export const logVitalSignActivity = async (userId, action, description, status = 'SUCCESS', errorDetails = null) => {
  await createLog({
    userId,
    level: status === 'SUCCESS' ? 'INFO' : 'WARN',
    action,
    entityType: 'PATIENT',
    description,
    status,
    errorDetails,
  });
};

/**
 * Get logs with filters
 */
export const getLogs = async (filters = {}, page = 0, size = 50) => {
  try {
    const query = {};
    if (filters.userId) query.user_id = filters.userId;
    if (filters.level) query.level = filters.level;
    if (filters.action) query.action = { $regex: filters.action, $options: 'i' };
    if (filters.entityType) query.entity_type = filters.entityType;
    if (filters.status) query.status = filters.status;

    const skip = page * size;
    const logs = await Log.find(query)
      .populate('user_id', 'full_name email')
      .populate('admin_id', 'full_name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(size)
      .lean();

    const total = await Log.countDocuments(query);

    return {
      content: logs,
      totalPages: Math.ceil(total / size),
      totalElements: total,
      currentPage: page,
      size,
    };
  } catch (error) {
    throw new Error(`Failed to fetch logs: ${error.message}`);
  }
};

/**
 * Get user activity summary
 */
export const getUserActivitySummary = async (userId) => {
  try {
    const logs = await Log.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();

    return logs;
  } catch (error) {
    throw new Error(`Failed to fetch user activity: ${error.message}`);
  }
};
