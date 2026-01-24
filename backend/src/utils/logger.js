import Log from '../models/Log.js';

const getIpAddress = (req) => {
  try {
    const forwarded = req?.headers?.['x-forwarded-for'];
    if (forwarded) {
      const parts = Array.isArray(forwarded) ? forwarded : String(forwarded).split(',');
      return parts[0]?.trim();
    }
    return req?.ip || req?.connection?.remoteAddress || undefined;
  } catch {
    return undefined;
  }
};

export const logAction = async ({
  req,
  userId,
  adminId,
  action,
  entityType,
  entityId,
  description,
  status = 'SUCCESS',
  level = 'INFO',
  error,
}) => {
  try {
    const entry = new Log({
      user_id: userId,
      admin_id: adminId,
      level,
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      ip_address: getIpAddress(req),
      status,
      error_details: error ? (error.stack || error.message || String(error)) : undefined,
    });
    await entry.save();
  } catch (e) {
    // Avoid throwing from logger; swallow to not impact main flow
    if (process.env.NODE_ENV !== 'production') {
      console.warn('LogAction failed:', e?.message);
    }
  }
};

export const logSuccess = async (params) =>
  logAction({ ...params, status: 'SUCCESS', level: params?.level || 'INFO' });

export const logFailure = async (params) =>
  logAction({ ...params, status: 'FAILURE', level: params?.level || 'ERROR' });

export default {
  logAction,
  logSuccess,
  logFailure,
};
