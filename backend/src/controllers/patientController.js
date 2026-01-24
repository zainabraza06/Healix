import { getAllPatients, getPatientById, togglePatientStatus, getPatientDashboardData, getVitalsHistory } from '../services/patientService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logSuccess, logFailure } from '../utils/logger.js';

/**
 * Get all patients
 */
export const getAllPatientsController = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 0;
    const size = parseInt(req.query.size) || 10;
    const search = req.query.search || '';

    const patients = await getAllPatients(page, size, search);
    res.json(successResponse('Patients retrieved successfully.', patients));
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient by ID
 */
export const getPatientByIdController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const patient = await getPatientById(patientId);
    res.json(successResponse('Patient retrieved successfully.', patient));
  } catch (error) {
    next(error);
  }
};

/**
 * Disable patient
 */
export const disablePatientController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    await togglePatientStatus(patientId, false);
    res.json(successResponse('Patient disabled successfully.'));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'DISABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: patientId,
      description: `Patient disabled: ${patientId}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'DISABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: req?.params?.patientId,
      description: 'Disable patient failed',
      error,
    });
    next(error);
  }
};

/**
 * Enable patient
 */
export const enablePatientController = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    await togglePatientStatus(patientId, true);
    res.json(successResponse('Patient enabled successfully.'));
    await logSuccess({
      req,
      adminId: req?.user?._id,
      action: 'ENABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: patientId,
      description: `Patient enabled: ${patientId}`,
    });
  } catch (error) {
    await logFailure({
      req,
      adminId: req?.user?._id,
      action: 'ENABLE_PATIENT',
      entityType: 'PATIENT',
      entityId: req?.params?.patientId,
      description: 'Enable patient failed',
      error,
    });
    next(error);
  }
};

/**
 * Get patient dashboard data
 */
export const getPatientDashboardController = async (req, res, next) => {
  try {
    const data = await getPatientDashboardData(req.user._id);
    res.json(successResponse('Dashboard data retrieved.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get vital signs history
 */
export const getVitalsHistoryController = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const data = await getVitalsHistory(req.user._id, days);
    res.json(successResponse('Vitals history retrieved.', data));
  } catch (error) {
    next(error);
  }
};

/**
 * Get patient profile
 */
export const getPatientProfileController = async (req, res, next) => {
  try {
    const patient = await getPatientById(req.user._id);
    res.json(successResponse('Profile retrieved.', patient));
  } catch (error) {
    next(error);
  }
};

/**
 * Update patient profile
 */
export const updatePatientProfileController = async (req, res, next) => {
  try {
    res.json(successResponse('Profile update triggered (STUB).'));
  } catch (error) {
    next(error);
  }
};
