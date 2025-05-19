package com.example.demo.Service;

import com.example.demo.Controllers.PatientAppointmentController;
import com.example.demo.Exceptions.BadRequestException;
import com.example.demo.Exceptions.ResourceNotFoundException;
import com.example.demo.Models.Appointment;
import com.example.demo.Models.Appointment.Status;
import com.example.demo.Models.Doctor;
import com.example.demo.Models.Feedback;
import com.example.demo.Models.Patient;
import com.example.demo.Models.Prescription;
import com.example.demo.dto.AppointmentRequestDTO;
import com.example.demo.dto.TimeSlotDto;
import com.example.demo.respository.AppointmentRepository;
import com.example.demo.Exceptions.AppointmentException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;



import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
   
    private static final Logger log = LoggerFactory.getLogger(PatientAppointmentController.class);
    private final EmailService emailService;
    private final UserService userService;

    @Autowired
    public AppointmentService(AppointmentRepository appointmentRepository, EmailService emailService,
    UserService userService) {
        this.appointmentRepository = appointmentRepository;
        this.emailService = emailService;
        this.userService=userService;
 
    }

    @Transactional
    public void bookAppointment(Patient patient, Doctor doctor, AppointmentRequestDTO appointmentRequest) {
        LocalDateTime startTime = appointmentRequest.getDateTime();
     

        // Create a Duration of 30 minutes
        Duration duration = Duration.ofMinutes(30);

        LocalDateTime endTime = startTime.plus(duration);
        
        validateAppointmentTime(startTime, endTime);
        checkDoctorAvailability(doctor, startTime, endTime);
        
        Appointment appointment = new Appointment(
            patient, 
            doctor, 
            startTime, 
            endTime, 
            appointmentRequest.getReason(), 
            appointmentRequest.getLocation()
        );
        
        appointmentRepository.save(appointment);
        sendAppointmentConfirmationEmails(
            patient, 
            doctor, 
            startTime, 
            endTime, 
            appointmentRequest.getLocation(), 
            appointmentRequest.getReason()
        );
    }

    private void sendAppointmentConfirmationEmails(Patient patient, Doctor doctor, 
                                                 LocalDateTime startTime, LocalDateTime endTime,
                                                 Appointment.Location location, String reason) {
        try {
            Duration duration = Duration.between(startTime, endTime);
            emailService.sendPatientAppointmentConfirmation(
                patient.getEmail(),
                patient.getFirstName() + " " + patient.getLastName(),
                "Dr. " + doctor.getFirstName() + " " + doctor.getLastName(),
                startTime,
                duration,
                location.toString()
            );
            
            emailService.sendDoctorAppointmentNotification(
                doctor.getEmail(),
                doctor.getFirstName() + " " + doctor.getLastName(),
                patient.getFirstName() + " " + patient.getLastName(),
                startTime,
                duration,
                location.toString(),
                reason
            );
        } catch (Exception e) {
            System.err.println("Failed to send confirmation emails: " + e.getMessage());
        }
    }

    private void validateAppointmentTime(LocalDateTime startTime, LocalDateTime endTime) {
        int startHour = startTime.getHour();
        int endHour = endTime.getHour();
        
        if (startHour < 9 || endHour > 17 || (endHour == 17 && endTime.getMinute() > 0)) {
            throw new IllegalArgumentException("Appointments must be scheduled between 9AM and 5PM");
        }
        
        if (startTime.isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Appointment time must be in the future");
        }
    }

    private void checkDoctorAvailability(Doctor doctor, LocalDateTime startTime, LocalDateTime endTime) {
        List<Appointment> existingAppointments = appointmentRepository
                .findOverlappingAppointments(doctor, startTime, endTime);
        
        if (!existingAppointments.isEmpty()) {
            throw new IllegalArgumentException("Doctor is not available at the selected time");
        }
    }

    public Optional<Appointment> getNextAppointmentWithinHour(String doctorUserId) {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime oneHourLater = now.plusHours(1);
        
        return appointmentRepository.findByDoctorUserIdAndStartTimeBetween(doctorUserId, now, oneHourLater)
                .stream()
                .filter(a -> a.getStatus() == Status.CONFIRMED)
                .min(Comparator.comparing(Appointment::getStartTime));
    }

    public int getPendingRequestsCount(String doctorUserId) {
        return appointmentRepository.findByDoctorUserIdAndStatus(doctorUserId, Status.SCHEDULED).size()+appointmentRepository.findByDoctorUserIdAndStatus(doctorUserId, Appointment.Status.RESCHEDULED).size();
    }

    public int getUpcomingAppointmentsCount(String doctorUserId) {
    return (int) appointmentRepository.findByDoctorUserIdAndStatusAndStartTimeAfter(
            doctorUserId,
            Status.CONFIRMED,
            LocalDateTime.now()
        ).stream()
        .filter(appointment -> appointment.getLocation() == Appointment.Location.IN_PERSON)
        .count();
}


    public int getTodayTelemedicineSessionsCount(String doctorUserId) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);
        
        return appointmentRepository.findByDoctorUserIdAndStartTimeBetweenAndZoomLinkIsNotNull(
            doctorUserId, 
            startOfDay, 
            endOfDay
        ).size();
    }

    public int getTodaysAppointmentsCount(String doctorUserId) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        LocalDateTime endOfDay = today.atTime(LocalTime.MAX);
        
        return appointmentRepository.findByDoctorUserIdAndStartTimeBetween(doctorUserId, startOfDay, endOfDay).size();
    }

    public int getAverageWaitTime(String doctorUserId) {
        LocalDate today = LocalDate.now();
        LocalDateTime startOfDay = today.atStartOfDay();
        
        List<Appointment> completedAppointments = appointmentRepository
                .findByDoctorUserIdAndStartTimeBetween(doctorUserId, startOfDay, LocalDateTime.now())
                .stream()
                .filter(a -> a.getStatus() == Status.COMPLETED)
                .collect(Collectors.toList());
        
        if (completedAppointments.isEmpty()) {
            return 0;
        }
        
        double averageMinutes = completedAppointments.stream()
                .mapToLong(a -> ChronoUnit.MINUTES.between(a.getStartTime(), a.getEndTime()))
                .average()
                .orElse(0);
        
        return (int) averageMinutes;
    }

  public List<Appointment> getTodaysAppointments(String doctorUserId) {
    LocalDate today = LocalDate.now();
    LocalDateTime startOfDay = today.atStartOfDay();
    LocalDateTime endOfDay = today.atTime(LocalTime.MAX);

    return appointmentRepository.findByDoctorUserIdAndStartTimeBetweenAndStatus(
            doctorUserId, startOfDay, endOfDay, Appointment.Status.CONFIRMED)
            .stream()
            .sorted(Comparator.comparing(Appointment::getStartTime))
            .collect(Collectors.toList());
}


    @Transactional
    public void cancelAppointment(Long appointmentId, String reason) throws Exception{
        log.info("Inside cancelAppointment method");
        log.info("Attempting to cancel appointment {}", appointmentId);
        Appointment appointment = appointmentRepository.findById(appointmentId).get();
log.info("Current status before cancellation: {}", appointment.getStatus());
        
        if (!canBeRescheduled(appointment)) {
            log.info("can't bbe cancelled");
            throw new BadRequestException("Appointment cannot be cancelled as it's within 24 hours");
        }
        
        appointment.setStatus(Appointment.Status.CANCELLED);
        appointment.setCancellationReason(reason);
        appointment.setUpdatedAt(LocalDateTime.now());
        appointmentRepository.save(appointment);
          log.info("Status after cancellation: {}", appointment.getStatus());
        
        try {
        sendCancellationNotification(appointment);
    } catch (Exception e) {
        
    }
    }

    @Transactional
    public void rescheduleAppointment(Long appointmentId, LocalDateTime newDateTime, 
                                          Appointment.Location newLocation) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found"));
        
        if (!canBeRescheduled(appointment)) {
            log.info("can't be rescheduled");
            throw new BadRequestException("Appointment cannot be rescheduled as it's within 24 hours");
        }
        
        Duration duration = Duration.between(appointment.getStartTime(), appointment.getEndTime());
        LocalDateTime newEndTime = newDateTime.plus(duration);
        
        validateAppointmentTime(newDateTime, newEndTime);
        checkDoctorAvailability(appointment.getDoctor(), newDateTime, newEndTime);
        
        appointment.setStartTime(newDateTime);
        appointment.setEndTime(newEndTime);
        appointment.setLocation(newLocation);
        appointment.setStatus(Status.RESCHEDULED);
        appointment.setUpdatedAt(LocalDateTime.now());
        log.info("rescheduled successfully");
        Appointment savedAppointment = appointmentRepository.save(appointment);
        log.info("sending email");
        sendRescheduleConfirmation(savedAppointment);
        
   
    }

    public boolean canBeRescheduled(Appointment appointment) {
        return appointment.getStartTime().isAfter(LocalDateTime.now().plusHours(24));
    }

    public Appointment getAppointmentByIdAndPatient(Long id, String patientEmail) throws ResourceNotFoundException {
        log.info("finding Apointment in method");
        Optional<Appointment> ap= appointmentRepository.findByIdAndPatientEmail(id, patientEmail);
        if(ap!=null){
            log.info("appointment found"+ ap.get().getId()+" "+ap.get().getPatient().getUserId());
            return ap.get();
        }else{
            log.info("not found throwing exception");
         throw new ResourceNotFoundException("Appointment not found");
    }}

    public boolean isTimeSlotAvailable(Long doctorId, LocalDateTime dateTime, 
                                    Duration duration, Long excludeAppointmentId) {
        LocalDateTime endTime = dateTime.plus(duration);
        
        boolean hasOverlap = appointmentRepository.existsOverlappingAppointments(
            doctorId, 
            dateTime, 
            endTime, 
            excludeAppointmentId
        );
        
        LocalTime start = dateTime.toLocalTime();
        LocalTime end = endTime.toLocalTime();
        
        boolean withinWorkingHours = !start.isBefore(LocalTime.of(9, 0)) && 
                                   !end.isAfter(LocalTime.of(17, 0));
        
        boolean notDuringLunch = start.isAfter(LocalTime.of(14, 0)) || 
                               end.isBefore(LocalTime.of(13, 0));
        
        return !hasOverlap && withinWorkingHours && notDuringLunch;
    }








    public Map<String, Object> getDoctorAvailability(String doctorId, LocalDate date, 
                                                 Duration duration, String excludeAppointmentId) {
    // Fetch appointments for the doctor on the given date
    List<Appointment> appointments = appointmentRepository
        .findByDoctorIdAndDate(doctorId, date, null);
        log.info("booked appointmetns"+ appointments.size());

    // Exclude the appointment if the ID is provided
    if (excludeAppointmentId != null && !excludeAppointmentId.isBlank()) {
        appointments = appointments.stream()
            .filter(app -> !app.getId().equals(excludeAppointmentId))
            .collect(Collectors.toList());
    }

    // Build the list of occupied time slots
    List<TimeSlotDto> occupiedSlots = appointments.stream()
        .map(app -> new TimeSlotDto(app.getStartTime(), app.getEndTime()))
        .collect(Collectors.toList());

    // Add the lunch break as an occupied slot
    LocalDateTime lunchStart = LocalDateTime.of(date, LocalTime.of(13, 0));
    LocalDateTime lunchEnd = LocalDateTime.of(date, LocalTime.of(14, 0));
    occupiedSlots.add(new TimeSlotDto(lunchStart, lunchEnd));

    // Calculate available slots
    List<TimeSlotDto> availableSlots = calculateAvailableSlots(date, duration, occupiedSlots);
    log.info("occupied" +occupiedSlots.size());
    log.info("avaliable" +availableSlots.size());

    // Return the results
    Map<String, Object> response = new HashMap<>();
    response.put("occupiedSlots", occupiedSlots);
    response.put("availableSlots", availableSlots);
    return response;
}


    private List<TimeSlotDto> calculateAvailableSlots(LocalDate date, Duration duration, 
                                                    List<TimeSlotDto> occupiedSlots) {
        List<TimeSlotDto> availableSlots = new ArrayList<>();
        LocalTime slotStart = LocalTime.of(9, 0);
        LocalTime end = LocalTime.of(17, 0);
        
        while (slotStart.plus(duration).isBefore(end) || slotStart.plus(duration).equals(end)) {
            if (slotStart.equals(LocalTime.of(13, 0))) {
                slotStart = LocalTime.of(14, 0);
                continue;
            }
            
            LocalTime currentStart = slotStart;
            LocalTime slotEnd = currentStart.plus(duration);
            
            boolean isAvailable = occupiedSlots.stream()
                .noneMatch(occupied -> isOverlapping(
                    LocalDateTime.of(date, currentStart),
                    LocalDateTime.of(date, slotEnd),
                    occupied.getStartDateTime(),
                    occupied.getEndDateTime()
                ));
            
            if (isAvailable) {
                availableSlots.add(new TimeSlotDto(
                    LocalDateTime.of(date, currentStart),
                    LocalDateTime.of(date, slotEnd)
                ));
            }
            
            slotStart = slotStart.plusMinutes(30);
        }
        
        return availableSlots;
    }

    private boolean isOverlapping(LocalDateTime start1, LocalDateTime end1, 
                                LocalDateTime start2, LocalDateTime end2) {
        return start1.isBefore(end2) && end1.isAfter(start2);
    }

    private void sendCancellationNotification(Appointment appointment) {
        try {
            emailService.sendAppointmentCancellation(
                appointment.getPatient().getEmail(),
                appointment.getPatient().getFullName(),
                appointment.getDoctor().getFullName(),
                appointment.getStartTime(),
                appointment.getLocation().toString()
            );

            emailService.sendDoctorAppointmentCancellation(appointment.getDoctor().getEmail(), appointment.getDoctor().getEmail(), 
            appointment.getPatient().getFullName(), appointment.getStartTime() , appointment.getCancellationReason(),   appointment.getLocation().toString());
        } catch (Exception e) {
            System.err.println("Failed to send cancellation notification: " + e.getMessage());
        }
    }

    private void sendRescheduleConfirmation(Appointment appointment) {
        try {
            Duration duration = Duration.between(appointment.getStartTime(), appointment.getEndTime());
            
            emailService.sendPatientAppointmentRescheduledConfirmation(
                appointment.getPatient().getEmail(),
                appointment.getPatient().getFullName(),
                appointment.getDoctor().getFullName(),
                appointment.getStartTime(),
                duration,
                appointment.getLocation().toString()
            );
            
            emailService.sendDoctorAppointmentRescheduledNotification(
                appointment.getDoctor().getEmail(),
                appointment.getDoctor().getFullName(),
                appointment.getPatient().getFullName(),
                appointment.getStartTime(),
                duration,
                appointment.getLocation().toString(),
                appointment.getReason()
            );
        } catch (Exception e) {
            System.err.println("Failed to send reschedule confirmation: " + e.getMessage());
        }
    }


public List<Appointment> getPatientAppointments(String userId) {
    LocalDateTime now = LocalDateTime.now();

    // Fetch all relevant appointments (past + future)
    List<Appointment> allAppointments = appointmentRepository.findByPatientUserIdAndStatusIn(
        userId,
        List.of(Appointment.Status.SCHEDULED, Appointment.Status.RESCHEDULED)
    );

    List<Appointment> futureAppointments = new ArrayList<>();

    for (Appointment appointment : allAppointments) {
        if (appointment.getStartTime().isAfter(now)) {
            futureAppointments.add(appointment);
        } else {
            // Cancel past appointment
            appointment.setStatus(Appointment.Status.CANCELLED);
            appointment.setCancellationReason("No response from doctor");
            appointmentRepository.save(appointment); // persist the change
        }
    }

    return futureAppointments;
}



   public Appointment getAppointmentById(Long id){
    Optional<Appointment> appointment= appointmentRepository.findById(id);
    return appointment.get();
   }


   public List<Appointment> getConfirmedInPersonAppointmentsForPatient(String patientId) {
        return appointmentRepository.findByPatientIdAndStatusAndLocation(
            patientId, 
            Appointment.Status.CONFIRMED, 
            Appointment.Location.IN_PERSON
        );
    }


     public List<Appointment> getPatientOnlineAppointments(String patientId) {
        Patient patient = (Patient)userService.findByuserId(patientId).get();
        return appointmentRepository.findByPatientAndLocationAndStatus(
            patient, 
            Appointment.Location.ONLINE, 
            Status.CONFIRMED
        );
    }

    public List<Appointment> getUpcomingOnlineAppointments(String patientId) {
        Patient patient = (Patient)userService.findByuserId(patientId).get();
        return appointmentRepository.findByPatientAndLocationAndStatusAndStartTimeAfter(
            patient,
            Appointment.Location.ONLINE,
            Status.CONFIRMED,
            LocalDateTime.now()
        );
    }



   public List<Appointment> getAppointmentsByDoctorAndLocation(String doctorId, Appointment.Location location) {
    List<Appointment> allAppointments = appointmentRepository.findByDoctorUserIdAndLocationOrderByStartTimeAsc(doctorId, location);
    LocalDateTime now = LocalDateTime.now();

    List<Appointment> validAppointments = new ArrayList<>();

    for (Appointment appointment : allAppointments) {
        if (appointment.getStartTime().isAfter(now)) {
            Appointment.Status status = appointment.getStatus();
            if (status == Appointment.Status.SCHEDULED || status == Appointment.Status.RESCHEDULED) {
                validAppointments.add(appointment);
            }
        } else {
            // Cancel past appointment
            appointment.setStatus(Appointment.Status.CANCELLED);
            appointment.setCancellationReason("No response from doctor");
            appointmentRepository.save(appointment);
        }
    }

    return validAppointments;
}



  
   @Transactional
public void confirmAppointment(Long appointmentId, String doctorId, String zoomLink, Doctor doctor) {
    Appointment appointment = appointmentRepository.findById(appointmentId)
        .orElseThrow(() -> new AppointmentException("Appointment not found"));
    
    // Verify the doctor owns this appointment
    if (!appointment.getDoctor().getUserId().equals(doctorId)) {
        throw new AppointmentException("You are not authorized to confirm this appointment");
    }
    
    // Check if doctor is available during this time slot
    List<Appointment> overlappingAppointments = appointmentRepository
        .findOverlappingAppointmentsForConfirmation(
            appointment.getDoctor(),
            appointment.getStartTime(),
            appointment.getEndTime(),
            appointmentId // exclude current appointment from availability check
        );
    
    if (!overlappingAppointments.isEmpty()) {
        throw new AppointmentException("Doctor is not available at the selected time slot");
    }
    
    if (appointment.getLocation() == Appointment.Location.ONLINE && (zoomLink == null || zoomLink.isBlank())) {
        throw new AppointmentException("Zoom link is required for online appointments");
    }
    
    appointment.setStatus(Appointment.Status.CONFIRMED);
    appointment.setZoomLink(zoomLink);
    appointment.setUpdatedAt(LocalDateTime.now());
    
    appointmentRepository.save(appointment);
    
    // Send confirmation email
    emailService.sendAppointmentConfirmationByDoctor(
        appointment.getPatient().getEmail(),
        appointment.getPatient().getFirstName() + " " + appointment.getPatient().getLastName(),
        doctor.getFirstName() + " " + doctor.getLastName(),
        appointment.getStartTime(),
        Duration.between(appointment.getStartTime(), appointment.getEndTime()),
        appointment.getLocation().name(),
        zoomLink
    );
}
    @Transactional
    public void cancelAppointment(Long appointmentId, String doctorId, String cancellationReason,Doctor doctor) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
            .orElseThrow(() -> new AppointmentException("Appointment not found"));
            
        
        // Verify the doctor owns this appointment
        if (!appointment.getDoctor().getUserId().equals(doctorId)) {
            throw new AppointmentException("You are not authorized to cancel this appointment");
        }
        
        if (cancellationReason == null || cancellationReason.isBlank()) {
            throw new AppointmentException("Cancellation reason is required");
        }
        
        appointment.setStatus(Appointment.Status.CANCELLED);
        appointment.setCancellationReason(cancellationReason);
        appointmentRepository.save(appointment);
        emailService.sendAppointmentCancellationByDoctor(
            appointment.getPatient().getEmail(),
            appointment.getPatient().getFirstName() + " " + appointment.getPatient().getLastName(),
            doctor.getFirstName() + " " + doctor.getLastName(),
            appointment.getStartTime(),
            appointment.getLocation().name(),
            cancellationReason
        );
    }

 public List<Appointment> getPastAppointments(Doctor doctor, LocalDateTime date) {
    return appointmentRepository.findByDoctorAndStartTimeBeforeAndLocationAndStatus(
            doctor, date,  Appointment.Location.IN_PERSON, Appointment.Status.CONFIRMED);
}

public List<Appointment> getFutureAppointments(Doctor doctor, LocalDateTime date) {
    return appointmentRepository.findByDoctorAndStartTimeAfterAndLocationAndStatus(
            doctor, date,  Appointment.Location.IN_PERSON, Appointment.Status.CONFIRMED);
}

 public List<Appointment> getPastOnlineAppointments(Doctor doctor, LocalDateTime date) {
    return appointmentRepository.findByDoctorAndStartTimeBeforeAndLocationAndStatus(
            doctor, date,  Appointment.Location.ONLINE, Appointment.Status.CONFIRMED);
}

public List<Appointment> getFutureOnlineAppointments(Doctor doctor, LocalDateTime date) {
    return appointmentRepository.findByDoctorAndStartTimeAfterAndLocationAndStatus(
            doctor, date, Appointment.Location.ONLINE, Appointment.Status.CONFIRMED);
}

  @Transactional
    public Appointment completeAppointment(Long appointmentId, Doctor doctor) {
        Appointment appointment = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new RuntimeException("Appointment not found"));

        appointment.setStatus(Appointment.Status.COMPLETED);
        Appointment savedAppointment = appointmentRepository.save(appointment);


        return savedAppointment;
    }



       public Appointment UpdatePrescriptionStatus(Long id, Prescription prescription){

        Appointment appointment =appointmentRepository.findById(id).orElseThrow(()-> new IllegalArgumentException( "Not Found Appointment for Id"));
         appointment.setPrescription(prescription);
        return appointmentRepository.save(appointment);
    }

    
    
    public Appointment UpdateFeedbackStatus(Long id, Feedback feedback){
 Appointment appointment =appointmentRepository.findById(id).orElseThrow(()-> new IllegalArgumentException( "Not Found Appoitment for Id"));
        appointment.setFeedback(feedback);
           return appointmentRepository.save(appointment);
    }

}
