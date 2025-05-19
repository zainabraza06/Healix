package com.example.demo.Controllers;

import com.example.demo.Models.*;
import com.example.demo.Service.ReportService;
import com.example.demo.Service.UserService;
import com.example.demo.respository.ReportRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.xhtmlrenderer.pdf.ITextRenderer;

import java.io.ByteArrayOutputStream;
import java.util.List;

@Controller
@RequestMapping("/patient/dashboard/reports")
public class ReportController {

    private final ReportService reportService;
    private final ReportRepository reportRepository;
    private final SpringTemplateEngine templateEngine;
    private final UserService userService;

    @Autowired
    public ReportController(ReportService reportService, 
                          ReportRepository reportRepository,
                          SpringTemplateEngine templateEngine, UserService userService) {
        this.reportService = reportService;
        this.reportRepository = reportRepository;
        this.templateEngine = templateEngine;
        this.userService=userService;
    }

  @GetMapping
public String viewReports(Authentication authentication, Model model) {
    String email = authentication.getName();
    Patient patient = (Patient) userService.findByEmail(email);
    List<Report> vitalReports = reportService.getVitalReportsForPatient(patient);
    List<Report> appointmentReports = reportService.getAppointmentReportsForPatient(patient);
    List<Report> alertReports = reportService.getAlertReportsForPatient(patient); // Add this line
    
    model.addAttribute("Math", Math.class);
    model.addAttribute("vitalReports", vitalReports);
    model.addAttribute("appointmentReports", appointmentReports);
    model.addAttribute("alertReports", alertReports); // Add this line
    model.addAttribute("patient", patient);
    
    return "patient/Report";
}

    @GetMapping("/download/vital/{id}")
    public ResponseEntity<Resource> downloadVitalReport(@PathVariable Long id, 
                                                      Authentication authentication, Model model) {
                                                          String email = authentication.getName();

         model.addAttribute("Math", Math.class);
            Patient patient = (Patient) userService.findByEmail(email);
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));
        
        if (report.getVitalSigns() == null || 
            !report.getVitalSigns().getPatient().getUserId().equals(patient.getUserId())) {
            throw new AccessDeniedException("You are not authorized to access this report");
        }
        
        VitalSigns vitalSigns = report.getVitalSigns();
        Patient reportPatient = vitalSigns.getPatient();
        Doctor doctor = vitalSigns.getDoctor();
        Prescription prescription = report.getPrescription();
        Feedback feedback = report.getFeedback();
        
        String htmlContent = generateVitalReportHtml(
            report,
            vitalSigns,
            reportPatient,
            doctor,
            prescription,
            feedback
        );
        
        byte[] pdfBytes = generatePdfFromHtml(htmlContent);
        String filename = String.format(
            "Vital_Report_%s_%s.pdf", 
            reportPatient.getLastName(), 
            report.getCreatedAt().toLocalDate()
        );
        
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                    HttpHeaders.CONTENT_DISPOSITION, 
                    "attachment; filename=\"" + filename + "\""
                )
                .body(new ByteArrayResource(pdfBytes));
    }

    @GetMapping("/download/appointment/{id}")
    public ResponseEntity<Resource> downloadAppointmentReport(@PathVariable Long id, 
                                                            Authentication authentication, Model model) {
                                                                  String email = authentication.getName();


            Patient patient = (Patient) userService.findByEmail(email);
        Report report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));


                model.addAttribute("Math", Math.class);
        
        if (report.getAppointment() == null || 
            !report.getAppointment().getPatient().getUserId().equals(patient.getUserId())) {
            throw new AccessDeniedException("You are not authorized to access this report");
        }
        
        Appointment appointment = report.getAppointment();
        Patient reportPatient = appointment.getPatient();
        Doctor doctor = appointment.getDoctor();
        Prescription prescription = report.getPrescription();
        Feedback feedback = report.getFeedback();
        
        String htmlContent = generateAppointmentReportHtml(
            report,
            appointment,
            reportPatient,
            doctor,
            prescription,
            feedback
        );
        
        byte[] pdfBytes = generatePdfFromHtml(htmlContent);
        String filename = String.format(
            "Appointment_Report_%s_%s.pdf", 
            reportPatient.getLastName(), 
            report.getCreatedAt().toLocalDate()
        );
        
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                    HttpHeaders.CONTENT_DISPOSITION, 
                    "attachment; filename=\"" + filename + "\""
                )
                .body(new ByteArrayResource(pdfBytes));
    }

    private String generateVitalReportHtml(Report report, 
                                         VitalSigns vitalSigns,
                                         Patient patient,
                                         Doctor doctor,
                                         Prescription prescription,
                                         Feedback feedback) {
        Context context = new Context();
        context.setVariable("report", report);
        context.setVariable("vitalSigns", vitalSigns);
        context.setVariable("patient", patient);
        context.setVariable("doctor", doctor);
        context.setVariable("prescription", prescription);
        context.setVariable("feedback", feedback);
        
        return templateEngine.process("pdf/vital-report-full", context);
    }

    private String generateAppointmentReportHtml(Report report, 
                                               Appointment appointment,
                                               Patient patient,
                                               Doctor doctor,
                                               Prescription prescription,
                                               Feedback feedback) {
        Context context = new Context();
        context.setVariable("report", report);
        context.setVariable("appointment", appointment);
        context.setVariable("patient", patient);
        context.setVariable("doctor", doctor);
        context.setVariable("prescription", prescription);
        context.setVariable("feedback", feedback);
        
        return templateEngine.process("pdf/appointment-report-full", context);
    }

    private byte[] generatePdfFromHtml(String htmlContent) {
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            ITextRenderer renderer = new ITextRenderer();
            renderer.setDocumentFromString(htmlContent);
            renderer.layout();
            renderer.createPDF(outputStream);
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate PDF", e);
        }
    }



    @GetMapping("/download/alert/{id}")
public ResponseEntity<Resource> downloadAlertReport(@PathVariable Long id, 
                                                  Authentication authentication, Model model) {
    String email = authentication.getName();
    model.addAttribute("Math", Math.class);
    Patient patient = (Patient) userService.findByEmail(email);
    
    Report report = reportRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Report not found"));
    
    if (report.getAlert() == null || 
        !report.getAlert().getPatient().getUserId().equals(patient.getUserId())) {
        throw new AccessDeniedException("You are not authorized to access this report");
    }
    
    Alert alert = report.getAlert();
    Patient reportPatient = alert.getPatient();
    Doctor doctor = alert.getDoctor();
    Prescription prescription = report.getPrescription();
    Feedback feedback = report.getFeedback();
    
    String htmlContent = generateAlertReportHtml(
        report,
        alert,
        reportPatient,
        doctor,
        prescription,
        feedback
    );
    
    byte[] pdfBytes = generatePdfFromHtml(htmlContent);
    String filename = String.format(
        "Alert_Report_%s_%s.pdf", 
        reportPatient.getLastName(), 
        report.getCreatedAt().toLocalDate()
    );
    
    return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header(
                HttpHeaders.CONTENT_DISPOSITION, 
                "attachment; filename=\"" + filename + "\""
            )
            .body(new ByteArrayResource(pdfBytes));
}

private String generateAlertReportHtml(Report report, 
                                     Alert alert,
                                     Patient patient,
                                     Doctor doctor,
                                     Prescription prescription,
                                     Feedback feedback) {
    Context context = new Context();
    context.setVariable("report", report);
    context.setVariable("alert", alert);
    context.setVariable("patient", patient);
    context.setVariable("doctor", doctor);
    context.setVariable("prescription", prescription);
    context.setVariable("feedback", feedback);
    
    return templateEngine.process("pdf/alert-report-full", context);
}
}