package com.example.demo.respository;

import com.example.demo.Models.Appointment;
import com.example.demo.Models.Doctor;
import com.example.demo.Models.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.Optional;
import java.time.LocalDate;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    // Basic CRUD operations
    Optional<Appointment> findById(Long id);
    
    // Find all appointments for a specific doctor
    List<Appointment> findByDoctor(Doctor doctor);

    // Find appointments for a doctor after a specific time
    List<Appointment> findByDoctorAndStartTimeAfter(Doctor doctor, LocalDateTime startTime);

    // Find appointments by patient userId (String)
    List<Appointment> findByPatientUserId(String patientUserId);

    // Delete appointments by patient userId
    void deleteByPatientUserId(String patientUserId);

    // Find upcoming appointments for a doctor (using doctor's userId - String)
    List<Appointment> findByDoctorUserIdAndStartTimeAfter(String doctorUserId, LocalDateTime start);

    // Find appointments by status (using doctor's userId - String)
    List<Appointment> findByDoctorUserIdAndStatus(String doctorUserId, Appointment.Status status);

    // Find upcoming appointments with specific status
    List<Appointment> findByDoctorUserIdAndStatusAndStartTimeAfter(
        String doctorUserId, 
        Appointment.Status status, 
        LocalDateTime start
    );

    // Find appointments by status before a specific time
    List<Appointment> findByStatusAndStartTimeBefore(Appointment.Status status, LocalDateTime time);

    // Find telemedicine appointments for a doctor in a time range
    List<Appointment> findByDoctorUserIdAndStartTimeBetweenAndZoomLinkIsNotNull(
        String doctorUserId, 
        LocalDateTime start, 
        LocalDateTime end
    );

    // Find appointments by location
    List<Appointment> findByLocation(Appointment.Location location);

    // Count distinct patients for a doctor
    @Query("SELECT COUNT(DISTINCT a.patient.id) FROM Appointment a WHERE a.doctor.userId = :doctorUserId")
    int countDistinctPatientsByDoctorUserId(@Param("doctorUserId") String doctorUserId);

    // Find appointments that are about to start (for notifications)
    @Query("SELECT a FROM Appointment a WHERE " +
           "a.startTime BETWEEN :now AND :reminderTime AND " +
           "a.status = 'SCHEDULED'")
    List<Appointment> findUpcomingAppointmentsForReminder(
        @Param("now") LocalDateTime now,
        @Param("reminderTime") LocalDateTime reminderTime
    );

    // Find overlapping appointments (using Doctor entity)
    @Query("SELECT a FROM Appointment a WHERE " +
       "a.doctor = :doctor AND " +
       "a.status <> 'CANCELLED' AND " +
       "((a.startTime < :endTime AND a.endTime > :startTime))")
    List<Appointment> findOverlappingAppointments(
        @Param("doctor") Doctor doctor, 
        @Param("startTime") LocalDateTime startTime, 
        @Param("endTime") LocalDateTime endTime
    );

    // Find appointments by doctor userId in time range
    List<Appointment> findByDoctorUserIdAndStartTimeBetween(String doctorUserId, LocalDateTime start, LocalDateTime end);

    // Find distinct confirmed patient IDs for a doctor
    @Query("SELECT DISTINCT a.patient.userId FROM Appointment a " +
       "WHERE a.doctor.userId = :doctorUserId AND a.status = 'CONFIRMED'")
    Set<String> findDistinctConfirmedPatientIdsByDoctorUserId(@Param("doctorUserId") String doctorUserId);

    // Find appointments with prescriptions
    @Query("SELECT a FROM Appointment a WHERE a.prescription IS NOT NULL AND a.doctor.userId = :doctorUserId")
    List<Appointment> findAppointmentsWithPrescriptionsByDoctor(@Param("doctorUserId") String doctorUserId);
    
    // Find appointments with feedback
    @Query("SELECT a FROM Appointment a WHERE a.feedback IS NOT NULL AND a.doctor.userId = :doctorUserId")
    List<Appointment> findAppointmentsWithFeedbackByDoctor(@Param("doctorUserId") String doctorUserId);

    // Find appointment by ID and patient email
    Optional<Appointment> findByIdAndPatientEmail(Long id, String patientEmail);
    
 @Query("SELECT a FROM Appointment a " +
       "WHERE a.doctor.id = :doctorId " +
       "AND CAST(a.startTime AS date) = :date " +
       "AND (:excludeAppointmentId IS NULL OR a.id != :excludeAppointmentId)")
List<Appointment> findByDoctorIdAndDate(
    @Param("doctorId") String doctorId,  // String type for doctor ID
    @Param("date") LocalDate date,
    @Param("excludeAppointmentId") Long excludeAppointmentId);  // Long type for appointment ID


    
    // Check for overlapping appointments
    @Query("SELECT COUNT(a) > 0 FROM Appointment a " +
           "WHERE a.doctor.id = :doctorId " +
           "AND ((a.startTime < :endTime AND a.endTime > :startTime) " +
           "AND a.id != :excludeAppointmentId)")
    boolean existsOverlappingAppointments(
        @Param("doctorId") Long doctorId,
        @Param("startTime") LocalDateTime startTime,
        @Param("endTime") LocalDateTime endTime,
        @Param("excludeAppointmentId") Long excludeAppointmentId);

    @Query("SELECT a FROM Appointment a " +
       "WHERE a.patient.id = :patientId " +
       "AND a.status = :status " +
       "AND a.location = :location " +
       "AND a.startTime > CURRENT_TIMESTAMP " +
       "ORDER BY a.startTime ASC")
    List<Appointment> findByPatientIdAndStatusAndLocation(
        @Param("patientId") String patientId,
        @Param("status") Appointment.Status status,
        @Param("location") Appointment.Location location
    );

    // Find all online appointments for a patient with specific status
    List<Appointment> findByPatientAndLocationAndStatus(Patient patient, Appointment.Location location, Appointment.Status status);
    
    // Find upcoming online appointments (for notification purposes)
    List<Appointment> findByPatientAndLocationAndStatusAndStartTimeAfter(
        Patient patient, 
        Appointment.Location location, 
        Appointment.Status status,
        LocalDateTime startTime
    );
    
    // Find online appointments within a time range
    List<Appointment> findByPatientAndLocationAndStatusAndStartTimeBetween(
        Patient patient,
        Appointment.Location location,
        Appointment.Status status,
        LocalDateTime start,
        LocalDateTime end
    );

    List<Appointment> findByPatientUserIdAndStatusIn(String userId, List<Appointment.Status> statuses);


     List<Appointment> findByDoctorUserIdAndLocationOrderByStartTimeAsc(String doctorId,Appointment.Location location);
    Appointment findByIdAndDoctorUserId(Long id, String doctorId);


    List<Appointment> findByDoctorAndStartTimeBeforeAndLocationAndStatus(Doctor doctor, LocalDate date, Appointment.Location location, Appointment.Status status);
List<Appointment> findByDoctorAndStartTimeAfterAndLocationAndStatus(Doctor doctor, LocalDateTime date, Appointment.Location location, Appointment.Status status);


@Query("SELECT a FROM Appointment a " +
       "WHERE a.doctor = :doctor " +
       "AND a.status = 'CONFIRMED' " +
       "AND a.id != :excludeAppointmentId " +
       "AND ((a.startTime < :endTime AND a.endTime > :startTime))")
List<Appointment> findOverlappingAppointmentsForConfirmation(
    @Param("doctor") Doctor doctor,
    @Param("startTime") LocalDateTime startTime,
    @Param("endTime") LocalDateTime endTime,
    @Param("excludeAppointmentId") Long excludeAppointmentId
);



List<Appointment> findByDoctorUserIdAndStartTimeBetweenAndStatus(
    String doctorUserId,
    LocalDateTime start,
    LocalDateTime end,
    Appointment.Status status
);

List<Appointment> findByDoctorAndStartTimeBeforeAndLocationAndStatus(Doctor doctor, LocalDateTime date, Appointment.Location location, Appointment.Status status);

}