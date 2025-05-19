package com.example.demo.Service;


import com.example.demo.Models.*;
import com.example.demo.respository.ReportRepository;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final EmailService emailService;


    public ReportService(ReportRepository reportRepository, EmailService emailService) {
        this.reportRepository = reportRepository;
        this.emailService=emailService;
    }

    public List<Report> getVitalReportsForPatient(Patient patient) {
        return reportRepository.findByPatient(patient).stream()
                .filter(report -> report.getVitalSigns() != null)
                .collect(Collectors.toList());
    }

    public List<Report> getAppointmentReportsForPatient(Patient patient) {
        return reportRepository.findByPatient(patient).stream()
                .filter(report -> report.getAppointment() != null)
                .collect(Collectors.toList());
    }


    public void createReport(Appointment appointment){
        Report report=new Report();
        report.setAppointment(appointment);
        report.setPatient(appointment.getPatient());
        report.setFeedback(appointment.getFeedback());
        report.setPrescription(appointment.getPrescription());
        reportRepository.save(report);

        emailService.sendAppointmentReportReadyNotification(report.getPatient().getEmail(),report.getPatient().getFullName(),
        appointment.getDoctor().getFullName(), appointment.getStartTime());

    }


    public void createReport(VitalSigns vitalSigns){
        Report report=new Report();
        report.setVitalSigns(vitalSigns);
        report.setPatient(vitalSigns.getPatient());
        report.setFeedback(vitalSigns.getFeedback());
        report.setPrescription(vitalSigns.getPrescription());
        reportRepository.save(report);


         emailService.sendVitalReportReadyNotification(report.getPatient().getEmail(),report.getPatient().getFullName(),
        vitalSigns.getDoctor().getFullName());
    }



    public void createReport(Alert alert){

        Report report=new Report();
        report.setAlert(alert);
        report.setPatient(alert.getPatient());
        report.setFeedback(alert.getFeedback());
        report.setPrescription(alert.getPrescription());
        reportRepository.save(report);
     

        emailService.sendAlertReportReadyNotification(report.getPatient().getEmail(),report.getPatient().getFullName(),
        alert.getDoctor().getFullName());
    }
    

    public List<Report> getAlertReportsForPatient(Patient patient) {
    return reportRepository.findByPatientAndAlertIsNotNull(patient);
}
    }


   