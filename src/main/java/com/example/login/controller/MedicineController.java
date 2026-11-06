package com.example.login.controller;

import com.example.login.config.AccessPolicy;
import com.example.login.dto.FileData;
import com.example.login.model.Medicine;
import com.example.login.repository.MedicineRepository;
import com.example.login.util.FileTypes;
import com.example.login.util.MedicalTypes;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Medicines of a prescription: saved from the prescription popup of the record page, listed in the view page. */
@RestController
@RequestMapping("/api/medicines")
public class MedicineController {

    private static final int MAX_MEDICINES = 30;

    private final MedicineRepository medicines;
    private final AccessPolicy accessPolicy;

    public MedicineController(MedicineRepository medicines, AccessPolicy accessPolicy) {
        this.medicines = medicines;
        this.accessPolicy = accessPolicy;
    }

    /**
     * Save the medicines of one prescription. The medicines arrive as parallel lists
     * (medicine[i], description[i], morning[i], afternoon[i], night[i]); morning/afternoon/night are "true" or "false".
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> create(
            HttpServletRequest http,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String medicalType,
            @RequestParam(required = false) String drName,
            @RequestParam(required = false) String hospitalName,
            @RequestParam(required = false) MultipartFile image) throws IOException {

        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }

        String cleanName = required(name, 100, "Name");
        LocalDate medDate = parseDate(date);
        String type = MedicalTypes.find(required(medicalType, 100, "Medical type"))
                .orElseThrow(() -> new InvalidInputException("Please choose the medical type from the list"));
        String dr = optional(drName, 100, "Dr name");
        String hospital = optional(hospitalName, 150, "Hospital name");

        String[] names = http.getParameterValues("medicine");
        String[] descriptions = http.getParameterValues("description");
        String[] morning = http.getParameterValues("morning");
        String[] afternoon = http.getParameterValues("afternoon");
        String[] night = http.getParameterValues("night");
        int count = names == null ? 0 : names.length;
        if (count == 0) {
            throw new InvalidInputException("Add at least one medicine");
        }
        if (count > MAX_MEDICINES) {
            throw new InvalidInputException("A prescription can have at most " + MAX_MEDICINES + " medicines");
        }

        String fileName = null;
        String contentType = null;
        byte[] bytes = null;
        if (image != null && !image.isEmpty()) {
            String original = image.getOriginalFilename() == null ? "" : image.getOriginalFilename();
            fileName = StringUtils.getFilename(StringUtils.cleanPath(original));
            if (fileName == null || fileName.isBlank()) {
                fileName = "prescription";
            }
            if (fileName.length() > 255) {
                fileName = fileName.substring(fileName.length() - 255);
            }
            if (!FileTypes.isAllowed(fileName)) {
                throw new InvalidInputException("The prescription must be a PDF, PNG, JPG or Word (doc, docx) file");
            }
            contentType = FileTypes.contentType(fileName);
            bytes = image.getBytes();
        }

        String ref = UUID.randomUUID().toString();
        List<Medicine> rows = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            Medicine m = new Medicine();
            m.setCreatedBy(owner);
            m.setPrescriptionRef(ref);
            m.setSno(i + 1);
            m.setMedDate(medDate);
            m.setName(cleanName);
            m.setMedicalType(type);
            m.setDrName(dr);
            m.setHospitalName(hospital);
            m.setMedicine(required(at(names, i), 200, "Medicine " + (i + 1)));
            m.setDescription(optional(at(descriptions, i), 500, "Medicine description " + (i + 1)));
            m.setMorning("true".equalsIgnoreCase(at(morning, i)));
            m.setAfternoon("true".equalsIgnoreCase(at(afternoon, i)));
            m.setNight("true".equalsIgnoreCase(at(night, i)));
            m.setPrescriptionFileName(fileName);
            m.setPrescriptionContentType(contentType);
            if (i == 0) {
                m.setPrescriptionImage(bytes); // stored once per prescription
            }
            rows.add(m);
        }
        medicines.saveAll(rows);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("success", true, "message", "Medicines saved successfully", "count", count));
    }

    /** The logged-in user's medicines, or everyone's for the super user. */
    @GetMapping
    public ResponseEntity<Object> list(HttpServletRequest http) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(accessPolicy.isSuper(owner) ? medicines.findAllRows() : medicines.findRowsByOwner(owner));
    }

    /** The prescription file of one medicine row. Add ?download=true to force a download. */
    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(HttpServletRequest http, @PathVariable Long id,
                                        @RequestParam(defaultValue = "false") boolean download) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<FileData> found = accessPolicy.isSuper(owner)
                ? medicines.findImage(id) : medicines.findImageForOwner(id, owner);
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        FileData file = found.get();
        boolean inline = !download && FileTypes.isInline(file.fileName());
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(FileTypes.contentType(file.fileName())))
                .contentLength(file.data().length)
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(file.data());
    }

    // ---------- helpers ----------

    private static LocalDate parseDate(String date) {
        if (date == null || date.isBlank()) {
            throw new InvalidInputException("Date is required");
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidInputException("Date is invalid");
        }
    }

    private static String required(String value, int max, String label) {
        String v = optional(value, max, label);
        if (v == null) {
            throw new InvalidInputException(label + " is required");
        }
        return v;
    }

    private static String optional(String value, int max, String label) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String v = value.trim();
        if (v.length() > max) {
            throw new InvalidInputException(label + " must be at most " + max + " characters");
        }
        return v;
    }

    private static String at(String[] values, int index) {
        return values != null && index < values.length ? values[index] : null;
    }

    static class InvalidInputException extends RuntimeException {
        InvalidInputException(String message) {
            super(message);
        }
    }

    @ExceptionHandler(InvalidInputException.class)
    public ResponseEntity<Map<String, Object>> handleInvalid(InvalidInputException ex) {
        return ResponseEntity.badRequest().body(Map.of("success", false, "message", ex.getMessage()));
    }
}
