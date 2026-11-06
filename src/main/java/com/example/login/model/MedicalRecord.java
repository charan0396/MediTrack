package com.example.login.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;

/**
 * One saved record. created_by = the user who saved it; created_date = the "Date" typed on the record form;
 * updated_date = the day it was saved (automatic).
 */
@Entity
@Table(name = "medical_records")
public class MedicalRecord extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

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

    public void addAttachment(RecordAttachment attachment) {
        attachment.setMedicalRecord(this);
        attachments.add(attachment);
    }

    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

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
