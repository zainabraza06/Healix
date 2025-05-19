package com.example.demo.respository;


import com.example.demo.Models.Alert;
import com.example.demo.Models.Doctor;
import com.example.demo.Models.Patient;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

@Repository
public interface AlertRepository extends JpaRepository<Alert, Long> {
   
    
    @Query("SELECT a FROM Alert a WHERE a.doctor.id = :doctorId ORDER BY a.timestamp DESC")
    List<Alert> findAllAlertsByDoctorUserIdOrderedByTimestamp(String doctorId);
    
    @Query("SELECT a FROM Alert a WHERE a.doctor.id = :doctorId AND a.acknowledged = false ORDER BY a.timestamp DESC")
    List<Alert> findUnacknowledgedAlertsByDoctorUserId(String doctorId);


        List<Alert> findByDoctorUserIdAndAcknowledgedFalse(String doctorId);


    Page<Alert> findTopByDoctorUserIdOrderByTimestampDesc(
        String doctorId, Pageable pageable);



   List<Alert> findByDoctorAndAcknowledgedFalseOrderByTimestampDesc(Doctor doctor);
    List<Alert> findByDoctorAndAcknowledgedFalse(Doctor doctor);
    List<Alert> findByPatientAndAcknowledgedFalseOrderByTimestampDesc(Patient patient);
}