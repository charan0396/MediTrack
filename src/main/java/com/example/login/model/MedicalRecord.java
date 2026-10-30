package com.example.login.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "medical_records")
public class MedicalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Login name of the user who saved this record. */
    @Column(name = "owner_name", length = 50)
    private String ownerName;

    /** The day the record was submitted. Filled automatically on save. */
    @Column(name = "recorded_date")
    private LocalDate recordedDate;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    /** The "Date" typed on the record form. */
    @Column(name = "record_date", nullable = false)
    private LocalDate recordDate;

    /** Mandatory on the record form. Enforced by the app (not NOT NULL) so older rows still load. */
    @Column(name = "medical_type", length = 100)
    private String medicalType;

    @Column(name = "hospital_name", length = 150)
    private String hospitalName;

    @Column(name = "dr_name", length = 100)
    private String drName;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "diagnostic_center", length = 150)
    private String diagnosticCenter;

    @Column(name = "details", length = 1000)
    private String details;

    @Column(name = "diag_address", length = 255)
    private String diagAddress;

    /** Uploaded documents (prescription, bill, scan, others). Many files allowed per category. */
    @OneToMany(mappedBy = "medicalRecord", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<RecordAttachment> attachments = new ArrayList<>();

    @PrePersist
    void onCreate() {
        if (recordedDate == null) {
            recordedDate = LocalDate.now();
        }
    }

    public void addAttachment(RecordAttachment attachment) {
        attachment.setMedicalRecord(this);
        attachments.add(attachment);
    }

    public Long getId() { return id; }

    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }

    public LocalDate getRecordedDate() { return recordedDate; }
    public void setRecordedDate(LocalDate recordedDate) { this.recordedDate = recordedDate; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public LocalDate getRecordDate() { return recordDate; }
    public void setRecordDate(LocalDate recordDate) { this.recordDate = recordDate; }

    public String getMedicalType() { return medicalType; }
    public void setMedicalType(String medicalType) { this.medicalType = medicalType; }

    public String getHospitalName() { return hospitalName; }
    public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }

    public String getDrName() { return drName; }
    public void setDrName(String drName) { this.drName = drName; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public String getDiagnosticCenter() { return diagnosticCenter; }
    public void setDiagnosticCenter(String diagnosticCenter) { this.diagnosticCenter = diagnosticCenter; }

    public String getDetails() { return details; }
    public void setDetails(String details) { this.details = details; }

    public String getDiagAddress() { return diagAddress; }
    public void setDiagAddress(String diagAddress) { this.diagAddress = diagAddress; }

    public List<RecordAttachment> getAttachments() { return attachments; }
}
