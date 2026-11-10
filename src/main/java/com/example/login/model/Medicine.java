package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.LocalDate;

/**
 * One medicine of a prescription (table "medicines"). A prescription with several medicines is saved as several rows
 * that share the same prescription_ref and are numbered 1, 2, 3 ... in sno. The uploaded prescription image is stored
 * once, on the row with sno 1; every row keeps the file name.
 */
@Entity
@Table(name = "medicines")
public class Medicine extends Auditable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Same value on every row of one prescription. */
    @Column(name = "prescription_ref", nullable = false, length = 36)
    private String prescriptionRef;

    @Column(name = "sno", nullable = false)
    private int sno;

    /** The date typed in the prescription popup. */
    @Column(name = "med_date", nullable = false)
    private LocalDate medDate;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "medical_type", length = 100)
    private String medicalType;

    @Column(name = "dr_name", length = 100)
    private String drName;

    @Column(name = "hospital_name", length = 150)
    private String hospitalName;

    @Column(name = "medicine", nullable = false, length = 200)
    private String medicine;

    @Column(name = "medicine_description", length = 500)
    private String description;

    @Column(name = "morning", nullable = false)
    private boolean morning;

    @Column(name = "afternoon", nullable = false)
    private boolean afternoon;

    @Column(name = "night", nullable = false)
    private boolean night;

    @Column(name = "prescription_file_name", length = 255)
    private String prescriptionFileName;

    @Column(name = "prescription_content_type", length = 100)
    private String prescriptionContentType;

    /** Only on the row with sno 1 of a prescription. */
    @Lob
    @Column(name = "prescription_image")
    private byte[] prescriptionImage;

    public String getPrescriptionRef() { return prescriptionRef; }
    public String getPrescriptionFileName() { return prescriptionFileName; }
    public void setPrescriptionRef(String prescriptionRef) { this.prescriptionRef = prescriptionRef; }
    public void setSno(int sno) { this.sno = sno; }
    public void setMedDate(LocalDate medDate) { this.medDate = medDate; }
    public void setName(String name) { this.name = name; }
    public void setMedicalType(String medicalType) { this.medicalType = medicalType; }
    public void setDrName(String drName) { this.drName = drName; }
    public void setHospitalName(String hospitalName) { this.hospitalName = hospitalName; }
    public void setMedicine(String medicine) { this.medicine = medicine; }
    public void setDescription(String description) { this.description = description; }
    public void setMorning(boolean morning) { this.morning = morning; }
    public void setAfternoon(boolean afternoon) { this.afternoon = afternoon; }
    public void setNight(boolean night) { this.night = night; }
    public void setPrescriptionFileName(String prescriptionFileName) { this.prescriptionFileName = prescriptionFileName; }
    public void setPrescriptionContentType(String prescriptionContentType) { this.prescriptionContentType = prescriptionContentType; }
    public void setPrescriptionImage(byte[] prescriptionImage) { this.prescriptionImage = prescriptionImage; }
}
