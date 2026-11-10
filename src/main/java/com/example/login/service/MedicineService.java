package com.example.login.service;

import com.example.login.dto.FileData;
import com.example.login.model.Medicine;
import com.example.login.repository.MedicineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class MedicineService {

    /** One medicine line of a prescription. */
    public record Line(String medicine, String description, boolean morning, boolean afternoon, boolean night) {
    }

    /** The fields shared by all medicines of a prescription, and the optional prescription file. */
    public record Prescription(String name, LocalDate date, String medicalType, String drName, String hospitalName,
                               List<Line> lines, String fileName, String contentType, byte[] fileBytes) {
    }

    private final MedicineRepository medicines;

    public MedicineService(MedicineRepository medicines) {
        this.medicines = medicines;
    }

    /** Save a new prescription: one row per medicine; the file is stored once, on the first row. */
    @Transactional
    public void create(String user, Prescription p) {
        String ref = UUID.randomUUID().toString();
        List<Medicine> rows = new ArrayList<>();
        for (int i = 0; i < p.lines().size(); i++) {
            Medicine m = new Medicine();
            m.setCreatedBy(user);
            m.setPrescriptionRef(ref);
            fill(m, p, i);
            if (i == 0) {
                m.setPrescriptionImage(p.fileBytes());
            }
            rows.add(m);
        }
        medicines.saveAll(rows);
    }

    /**
     * Edit the prescription that row {@code id} belongs to. Rows are matched by position (sno): existing rows are
     * changed (updated_by / updated_date are set), extra lines become new rows, rows no longer listed are removed.
     * The stored file stays unless a new file is sent. Returns false when the row does not exist or is not the
     * user's (normal users can edit only their own).
     */
    @Transactional
    public boolean update(Long id, String user, boolean allUsers, Prescription p) {
        Medicine anchor = medicines.findById(id).orElse(null);
        if (anchor == null || (!allUsers && !user.equals(anchor.getCreatedBy()))) {
            return false;
        }
        List<Medicine> group = medicines.findByPrescriptionRefOrderBySnoAscIdAsc(anchor.getPrescriptionRef());
        List<Medicine> keep = new ArrayList<>();
        for (int i = 0; i < p.lines().size(); i++) {
            Medicine m;
            if (i < group.size()) {
                m = group.get(i);
                m.touch(user);
            } else {
                m = new Medicine();
                m.setCreatedBy(user);
                m.setPrescriptionRef(anchor.getPrescriptionRef());
                m.setPrescriptionFileName(group.get(0).getPrescriptionFileName());
            }
            fill(m, p, i);
            if (p.fileBytes() != null) {
                m.setPrescriptionFileName(p.fileName());
                m.setPrescriptionContentType(p.contentType());
                if (i == 0) {
                    m.setPrescriptionImage(p.fileBytes());
                }
            }
            keep.add(m);
        }
        if (group.size() > keep.size()) {
            medicines.deleteAll(group.subList(keep.size(), group.size()));
        }
        medicines.saveAll(keep);
        return true;
    }

    /** The prescription file of a medicine row. Read inside a transaction (PostgreSQL needs this for large objects). */
    @Transactional(readOnly = true)
    public Optional<FileData> findImage(Long id, String user, boolean allUsers) {
        return allUsers ? medicines.findImage(id) : medicines.findImageForOwner(id, user);
    }

    private static void fill(Medicine m, Prescription p, int index) {
        Line line = p.lines().get(index);
        m.setSno(index + 1);
        m.setMedDate(p.date());
        m.setName(p.name());
        m.setMedicalType(p.medicalType());
        m.setDrName(p.drName());
        m.setHospitalName(p.hospitalName());
        m.setMedicine(line.medicine());
        m.setDescription(line.description());
        m.setMorning(line.morning());
        m.setAfternoon(line.afternoon());
        m.setNight(line.night());
        if (p.fileName() != null && m.getPrescriptionFileName() == null) {
            m.setPrescriptionFileName(p.fileName());
            m.setPrescriptionContentType(p.contentType());
        }
    }
}
