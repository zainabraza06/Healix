package com.example.demo.respository;


import com.example.demo.Models.Patient;
import com.example.demo.Models.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findByVitalSignsPatientUserId(String userId);
    List<Report> findByAppointmentPatientUserId(String userId);
     List<Report> findByPatient(Patient patient);


     List<Report> findByPatientAndAlertIsNotNull(Patient patient);
}