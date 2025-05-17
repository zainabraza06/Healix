package com.example.demo.Models;

import jakarta.persistence.*;
import java.time.*;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;


@Entity
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
@Table(name = "appointments")
public class Appointment {

  @Id
@GeneratedValue(strategy = GenerationType.IDENTITY) // Use SEQUENCE if you're using Oracle/PostgreSQL
@Column(name = "id", nullable = false, updatable = false)
private Long id;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(name = "reason")
    private String reason;


    @Transient
    private int pixelOffset;


    @Column(name = "location")
    private Location location;

    @Column(name = "zoom_link")
    private String zoomLink;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private Status status;

    @Column(name = "cancellation_reason")
    private String cancellationReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // One-to-one relationship with Prescription (unidirectional)
    @OneToOne(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
        @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})  
    @JoinColumn(name = "prescription_id", referencedColumnName = "id")
    private Prescription prescription;

    // One-to-one relationship with Feedback (unidirectional)
    @OneToOne(cascade = CascadeType.ALL, fetch = FetchType.LAZY)
        @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})  
    @JoinColumn(name = "feedback_id", referencedColumnName = "id")
    private Feedback feedback;

    // Required by JPA
    protected Appointment() {}

    public Appointment(Patient patient, Doctor doctor, LocalDateTime startTime,
                     LocalDateTime endTime, String reason, Location location) {
        this.patient = patient;
        this.doctor = doctor;
        this.startTime = startTime;
        this.endTime = endTime;
        this.reason = reason;
        this.location = location;
        this.status = Status.SCHEDULED;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public Patient getPatient() { return patient; }
    public Doctor getDoctor() { return doctor; }
    public LocalDateTime getStartTime() { return startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public String getReason() { return reason; }
    public Location getLocation() { return location; }
    public String getZoomLink() { return zoomLink; }
    public Status getStatus() { return status; }
    public String getCancellationReason() { return cancellationReason; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public Prescription getPrescription() { return prescription; }
    public Feedback getFeedback() { return feedback; }

    public void setStartTime(LocalDateTime startTime) { 
        this.startTime = startTime; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setEndTime(LocalDateTime endTime) { 
        this.endTime = endTime; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setReason(String reason) { 
        this.reason = reason; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setLocation(Location location) { 
        this.location = location; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setZoomLink(String zoomLink) { 
        this.zoomLink = zoomLink; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setStatus(Status status) { 
        this.status = status; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setCancellationReason(String cancellationReason) { 
        this.cancellationReason = cancellationReason; 
        this.updatedAt = LocalDateTime.now();
    }
    public void setPrescription(Prescription prescription) {
        this.prescription = prescription;
        this.updatedAt = LocalDateTime.now();
    }
    public void setFeedback(Feedback feedback) {
        this.feedback = feedback;
        this.updatedAt = LocalDateTime.now();
    }
    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    // Helper method to calculate duration
    public Duration getDuration() {
        return Duration.between(startTime, endTime);
    }

    public enum Status {
        SCHEDULED, RESCHEDULED, CONFIRMED, 
        COMPLETED, CANCELLED, NO_SHOW
    }

    public enum Location {
    IN_PERSON,
    ONLINE
}

public void calculatePixelOffset() {
    if (this.startTime != null) {
        LocalTime baseTime = LocalTime.of(9, 0); // Start of schedule
        LocalTime start = this.startTime.toLocalTime();

        int minutesSinceStart = (int) Duration.between(baseTime, start).toMinutes();
        this.pixelOffset = Math.max(0, minutesSinceStart * 2); // 2px per minute
    } else {
        this.pixelOffset = 0;
    }
}

public int getPixelOffset() {
    return pixelOffset;
}

}