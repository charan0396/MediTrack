package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** One uploaded file (BLOB) belonging to a record. A record can have many files per category. */
@Entity
@Table(name = "record_attachments")
public class RecordAttachment {

    public static final String PRESCRIPTION = "prescription";
    public static final String BILL = "bill";
    public static final String SCAN = "scan";
    public static final String OTHERS = "others";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "record_id", nullable = false)
    private MedicalRecord medicalRecord;

    /** prescription | bill | scan | others */
    @Column(name = "category", nullable = false, length = 20)
    private String category;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", length = 100)
    private String contentType;

    @Lob
    @Column(name = "file_data", nullable = false)
    private byte[] data;

    public RecordAttachment() {
    }

    public RecordAttachment(String category, String fileName, String contentType, byte[] data) {
        this.category = category;
        this.fileName = fileName;
        this.contentType = contentType;
        this.data = data;
    }

    public Long getId() { return id; }

    public MedicalRecord getMedicalRecord() { return medicalRecord; }
    public void setMedicalRecord(MedicalRecord medicalRecord) { this.medicalRecord = medicalRecord; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }

    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }
}
