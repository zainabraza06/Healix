package com.example.demo.Models;

import jakarta.persistence.*;
import java.time.*;
import java.util.*;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "Doctor")
@PrimaryKeyJoinColumn(name = "user_id")
public class Doctor extends User {

    @Column(name = "license_number", nullable = false, unique = true)
    private String licenseNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "specialization", nullable = false)
    private Specialization specialization;

    @ElementCollection
    @CollectionTable(
        name = "doctor_qualifications", 
        joinColumns = @JoinColumn(name = "doctor_id", referencedColumnName = "user_id")
    )
    private   List<Qualification> qualifications = new ArrayList<>();

  

    public Doctor() {
        // Default constructor required by JPA
    }

    public Doctor(String userId, String firstName, String lastName, String email,
                 String password, LocalDate dateOfBirth, String address,
                 String phoneNumber, Gender gender, String nationality,
                 EmergencyContact emergencyContact, BloodType bloodType,
                 String identificationNumber, String licenseNumber,
                 Specialization specialization) {

        super( firstName, lastName, email, Role.DOCTOR, password,
              dateOfBirth, address, phoneNumber, gender,
              emergencyContact, bloodType);

        this.licenseNumber = licenseNumber;
        this.specialization = Objects.requireNonNull(specialization);
    }

    public enum Specialization {
        CARDIOLOGY, NEUROLOGY, ONCOLOGY, PEDIATRICS,
        ORTHOPEDICS, DERMATOLOGY, PSYCHIATRY, GENERAL
    }

    @Embeddable
    public static class Qualification {
        @Column(name = "name", nullable = false)
        private String name;


        @Column(name = "obtained_date")
        private LocalDate obtainedDate;

        @Column(name = "institution")
        private String institution;

        public Qualification() {
            // Default constructor for JPA
        }

        public Qualification(String name, Specialization specialization,
                           LocalDate obtainedDate, String institution) {
            this.name = Objects.requireNonNull(name);
            
            this.obtainedDate = obtainedDate;
            this.institution = institution;
        }

        // Getters and Setters
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        
        
        public LocalDate getObtainedDate() { return obtainedDate; }
        public void setObtainedDate(LocalDate obtainedDate) { this.obtainedDate = obtainedDate; }
        
        public String getInstitution() { return institution; }
        public void setInstitution(String institution) { this.institution = institution; }
    }

  

    // Getters and Setters
    public String getLicenseNumber() {
        return licenseNumber;
    }

    public void setLicenseNumber(String licenseNumber) {
        this.licenseNumber = licenseNumber;
    }

    public Specialization getSpecialization() {
        return specialization;
    }

    public void setSpecialization(Specialization specialization) {
        this.specialization = specialization;
    }

    public List<Qualification> getQualifications() {
        return qualifications;
    }

    public void setQualifications(List<Qualification> qualifications) {
        this.qualifications = qualifications;
    }

 

    @Override
    public void displayInfo() {
        System.out.println("\n=== DOCTOR PROFILE ===");
        System.out.printf("Dr. %s %s (%s)\n", getFirstName(), getLastName(), licenseNumber);
        System.out.println("Specialization: " + specialization);
        System.out.println("Qualifications:");
        qualifications.forEach(q -> 
            System.out.printf("- %s (%s, %s, %s)\n",
                q.getName(),  
                q.getObtainedDate(), q.getInstitution()
            )
        );
    }
}