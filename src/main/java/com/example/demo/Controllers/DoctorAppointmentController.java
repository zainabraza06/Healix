package com.example.demo.Controllers;

import com.example.demo.Models.*;
import com.example.demo.Service.AppointmentService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;
import com.example.demo.Service.UserService;
import com.example.demo.Service.PrescriptionService;
import com.example.demo.Service.FeedbackService;
import com.example.demo.Service.ReportService;

import java.util.Map;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;

@Controller
@RequestMapping("/doctor/dashboard/appointment")
public class DoctorAppointmentController {

    @Autowired
    private AppointmentService appointmentService;
    @Autowired
    private  PrescriptionService prescriptionService;


    @Autowired
    private  FeedbackService feedbackService;

    @Autowired
    private UserService userService;

    @Autowired
    private ReportService reportService;

 final Logger log = LoggerFactory.getLogger(PatientDashboardController.class);
  
    @GetMapping
    public String viewAppointments(Authentication authentication, Model model) {
        String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
        List<Appointment> inPersonAppointments = appointmentService.getAppointmentsByDoctorAndLocation(
            doctor.getUserId(), 
            Appointment.Location.IN_PERSON
        );
        
        List<Appointment> onlineAppointments = appointmentService.getAppointmentsByDoctorAndLocation(
            doctor.getUserId(), 
            Appointment.Location.ONLINE
        );
         

            
        
        model.addAttribute("inPersonAppointments", inPersonAppointments);
        model.addAttribute("onlineAppointments", onlineAppointments);
        model.addAttribute("doctor", doctor);
        
        return "doctor/doctorappointmentrequests";
    }

    @PostMapping("/confirm")
    public String confirmAppointment(
            @RequestParam Long appointmentId,
            @RequestParam(required = false) String zoomLink,
           Authentication authentication,
            RedirectAttributes redirectAttributes) {

                String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
        
        try {
            appointmentService.confirmAppointment(appointmentId, doctor.getUserId(), zoomLink, doctor);
           redirectAttributes.addFlashAttribute("flash", Map.of("success", "Appointment confirmed successfully"));

        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("flash", Map.of("error", e.getMessage()));
        }
        
        return "redirect:/doctor/dashboard/appointment";
    }

    @PostMapping("/cancel")
    public String cancelAppointment(
            @RequestParam Long appointmentId,
            @RequestParam String cancellationReason,
            Authentication authentication,
            RedirectAttributes redirectAttributes) {
        String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
        try {
            appointmentService.cancelAppointment(appointmentId, doctor.getUserId(), cancellationReason, doctor);
        
            redirectAttributes.addFlashAttribute("flash", Map.of("success", "Appointment cancelled successfully"));
        } catch (Exception e) {
            redirectAttributes.addFlashAttribute("flash", Map.of("error", e.getMessage()));
        }
        
        return "redirect:/doctor/dashboard/appointment";
    }


     @GetMapping("/in-person")
    public String viewInpersonAppointments(Authentication authentication,
                                  Model model) {
        String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
        LocalDateTime today = LocalDateTime.now();

        List<Appointment> pastAppointments = appointmentService.getPastAppointments(doctor, today);
        List<Appointment> futureAppointments = appointmentService.getFutureAppointments(doctor, today);

        model.addAttribute("doctor", doctor);
        model.addAttribute("pastAppointments", pastAppointments);
        model.addAttribute("futureAppointments", futureAppointments);

        return "doctor/UpcomingAppointments";
    }


    
     @GetMapping("/online")
    public String viewOnlineAppointments(Authentication authentication,
                                  Model model) {
        String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
        LocalDateTime today = LocalDateTime.now();
     

        List<Appointment> pastAppointments = appointmentService.getPastOnlineAppointments(doctor, today);
        List<Appointment> futureAppointments = appointmentService.getFutureOnlineAppointments(doctor, today);

        model.addAttribute("doctor", doctor);
        model.addAttribute("pastAppointments", pastAppointments);
        model.addAttribute("futureAppointments", futureAppointments);

        return "doctor/UpcomingAppointments";
    }
    


    
    @PostMapping("/{appointmentId}/complete")
    @ResponseBody
    public Map<String, Object> completeAppointment(
            @PathVariable Long appointmentId,
            Authentication authentication) {
                     Map<String, Object> response = new HashMap<>();

        try {
             String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
            Appointment appointment = appointmentService.completeAppointment(appointmentId, doctor);
            reportService.createReport(appointment);
                response.put("success", true);
            response.put("message", "Appointment marked as completed successfully.");
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "An error occurred: " + e.getMessage());
        }
        return response;
    }


     @PostMapping("/feedback")
    @ResponseBody
    public Map<String, Object> submitAlertFeedback(
            @RequestParam Long appointmentId,
            @RequestParam String patientId,
            @RequestParam String comments,
            Authentication authentication) {

        Map<String, Object> response = new HashMap<>();
        try {
            String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);
            Feedback feedback = feedbackService.createFeedback(patientId, doctor, comments);
           appointmentService.UpdateFeedbackStatus(appointmentId, feedback);

            response.put("success", true);
            response.put("message", "Feedback submitted successfully.");
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Error: " + e.getMessage());
        }
        return response;
    }


    @PostMapping("/prescribe")
    @ResponseBody
    public Map<String, Object> createAlertPrescription(
            @RequestParam Long appointmentId,
            @RequestParam String patientId,
            @RequestParam String medication,
            @RequestParam double dosageAmount,
            @RequestParam String dosageUnit,
            @RequestParam String frequency,
            @RequestParam String route,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) String instructions,
            Authentication authentication) {

        Map<String, Object> response = new HashMap<>();
        try {
            String email = authentication.getName();
            Doctor doctor = (Doctor) userService.findByEmail(email);

            Prescription.Dosage dosage = new Prescription.Dosage(
                dosageAmount, dosageUnit,
                Prescription.Frequency.valueOf(frequency),
                route
            );

            Prescription prescription = prescriptionService.createPrescription(
                patientId, doctor, medication,
                dosage, startDate, endDate, instructions
            );
            appointmentService.UpdatePrescriptionStatus(appointmentId, prescription);

            response.put("success", true);
            response.put("message", "Prescription created successfully.");
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Failed to create prescription: " + e.getMessage());
        }
        return response;
    }



   

}