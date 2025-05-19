package com.example.demo.Models;

import jakarta.persistence.*;
import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "Patient")
@PrimaryKeyJoinColumn(name = "user_id")
public class Patient extends User {

    public Patient() {
        // Default constructor for JPA
    }

    public Patient(String firstName, String lastName, String email,
                  String password, LocalDate dateOfBirth, String address,
                  String phoneNumber, Gender gender,
                  EmergencyContact emergencyContact, BloodType bloodType) {

        super(firstName, lastName, email, Role.PATIENT, password,
              dateOfBirth, address, phoneNumber, gender,
              emergencyContact, bloodType);

    }

   

    @Override
    public void displayInfo() {
        System.out.println("\n=== PATIENT DETAILS ===");
        System.out.printf("Name: %s %s\n", getFirstName(), getLastName());
        System.out.printf("DOB: %s | Gender: %s\n", getDateOfBirth(), getGender());
    }
}
