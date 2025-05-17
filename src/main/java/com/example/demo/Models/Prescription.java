package com.example.demo.Models;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor prescribingDoctor;

    @ManyToOne
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @NotBlank
    private String medication;

    private LocalDate datePrescribed;
    private LocalDate startDate;
    private LocalDate endDate;

    @Embedded
    private Dosage dosage;

    private String instructions;

    @Enumerated(EnumType.STRING)
    private PrescriptionStatus status;

    public Prescription() {
    }

    public Prescription(Doctor prescribingDoctor, Patient patient, String medication,
                        LocalDate datePrescribed, LocalDate startDate, Dosage dosage, String instructions) {
        this.prescribingDoctor = prescribingDoctor;
        this.patient = patient;
        this.medication = medication;
        this.datePrescribed = datePrescribed;
        this.startDate = startDate;
        this.dosage = dosage;
        this.instructions = instructions != null ? instructions : "Take as directed";
        this.status = PrescriptionStatus.ACTIVE;
    }

    // Getters
    public Long getId() {
        return id;
    }

    public Doctor getPrescribingDoctor() {
        return prescribingDoctor;
    }

    public Patient getPatient() {
        return patient;
    }

    public String getMedication() {
        return medication;
    }

    public LocalDate getDatePrescribed() {
        return datePrescribed;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public Dosage getDosage() {
        return dosage;
    }

    public String getInstructions() {
        return instructions;
    }

    public PrescriptionStatus getStatus() {
        return status;
    }

    // Setters
    public void setId(Long id) {
        this.id = id;
    }

    public void setPrescribingDoctor(Doctor prescribingDoctor) {
        this.prescribingDoctor = prescribingDoctor;
    }

    public void setPatient(Patient patient) {
        this.patient = patient;
    }

    public void setMedication(String medication) {
        this.medication = medication;
    }

    public void setDatePrescribed(LocalDate datePrescribed) {
        this.datePrescribed = datePrescribed;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public void setDosage(Dosage dosage) {
        this.dosage = dosage;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public void setStatus(PrescriptionStatus status) {
        this.status = status;
    }

    // ========== NESTED CLASSES ==========

    @Embeddable
    public static class Dosage {
        private double amount;
        private String unit;

        @Enumerated(EnumType.STRING)
        private Frequency frequency;
        private String route;

        public Dosage() {
        }

        public Dosage(double amount, String unit, Frequency frequency, String route) {
            this.amount = amount;
            this.unit = unit;
            this.frequency = frequency;
            this.route = route;
        }

        // Getters
        public double getAmount() {
            return amount;
        }

        public String getUnit() {
            return unit;
        }

        public Frequency getFrequency() {
            return frequency;
        }

        public String getRoute() {
            return route;
        }

        // Setters
        public void setAmount(double amount) {
            this.amount = amount;
        }

        public void setUnit(String unit) {
            this.unit = unit;
        }

        public void setFrequency(Frequency frequency) {
            this.frequency = frequency;
        }

        public void setRoute(String route) {
            this.route = route;
        }
    }

    public enum Frequency {
        PRN("As needed"), QD("Once daily"), BID("Twice daily"),
        TID("Three times daily"), QID("Four times daily"),
        QHS("At bedtime"), QOD("Every other day"), QWK("Once weekly");

        private final String description;

        Frequency(String description) {
            this.description = description;
        }

        public String getDescription() {
            return description;
        }
    }

    public enum PrescriptionStatus {
        ACTIVE, COMPLETED, CANCELLED, EXPIRED, ON_HOLD
    }
}
