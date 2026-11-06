package com.example.login.controller;

import com.example.login.config.AccessPolicy;
import com.example.login.dto.FileData;
import com.example.login.model.MedicalRecord;
import com.example.login.model.RecordAttachment;
import com.example.login.service.RecordService;
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
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/records")
public class RecordController {

    /** Most files accepted for one document type (prescription, bill, ...) in one record. */
    private static final int MAX_FILES_PER_TYPE = 10;

    private final RecordService recordService;
    private final AccessPolicy accessPolicy;

    public RecordController(RecordService recordService, AccessPolicy accessPolicy) {
        this.recordService = recordService;
        this.accessPolicy = accessPolicy;
    }

    /** Save a new record for the logged-in user (text fields + any number of files per type). */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> create(
            HttpServletRequest http,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String medicalType,
            @RequestParam(required = false) String hospitalName,
            @RequestParam(required = false) String drName,
            @RequestParam(required = false) String address,
            @RequestParam(required = false) String diagnosticCenter,
            @RequestParam(required = false) String details,
            @RequestParam(required = false) String diagAddress,
            @RequestParam(required = false) List<MultipartFile> prescription,
            @RequestParam(required = false) List<MultipartFile> bill,
            @RequestParam(required = false) List<MultipartFile> scanDocuments,
            @RequestParam(required = false) List<MultipartFile> others) throws IOException {

        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(notLoggedInBody());
        }

        MedicalRecord record = new MedicalRecord();
        record.setCreatedBy(owner);
        record.setName(required(name, 100, "Name"));
        record.setCreatedDate(parseDate(date).atStartOfDay()); // created_date = the Date typed on the form
        record.setMedicalType(MedicalTypes.find(required(medicalType, 100, "Medical type"))
                .orElseThrow(() -> new InvalidInputException("Please choose the medical type from the list")));
        record.setHospitalName(optional(hospitalName, 150, "Hospital name"));
        record.setDrName(optional(drName, 100, "Dr name"));
        record.setAddress(optional(address, 255, "Address"));
        record.setDiagnosticCenter(optional(diagnosticCenter, 150, "Diagnostic center"));
        record.setDetails(optional(details, 1000, "Details"));
        record.setDiagAddress(optional(diagAddress, 255, "Diag address"));
        // updated_date is filled automatically with the save date-time

        addFiles(record, prescription, RecordAttachment.PRESCRIPTION, "Prescription");
        addFiles(record, bill, RecordAttachment.BILL, "Bill");
        addFiles(record, scanDocuments, RecordAttachment.SCAN, "Scan documents");
        addFiles(record, others, RecordAttachment.OTHERS, "Others");

        MedicalRecord saved = recordService.save(record);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("success", true, "message", "Record saved successfully", "id", saved.getId()));
    }

    /**
     * Records for the view page: the logged-in user's own records, or every record for the super user.
     * File names only, no file bytes.
     */
    @GetMapping
    public ResponseEntity<Object> list(HttpServletRequest http) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(notLoggedInBody());
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(recordService.list(owner, accessPolicy.isSuper(owner)));
    }

    /** One uploaded file by its id. Add ?download=true to force a download instead of showing it. */
    @GetMapping("/files/{fileId}")
    public ResponseEntity<byte[]> file(HttpServletRequest http,
                                       @PathVariable Long fileId,
                                       @RequestParam(defaultValue = "false") boolean download) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<FileData> found = recordService.findFile(fileId, owner, accessPolicy.isSuper(owner));
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

    private static Map<String, Object> notLoggedInBody() {
        return Map.of("success", false, "message", "Please log in again");
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

    /** Adds every non-empty uploaded file of one document type to the record. */
    private static void addFiles(MedicalRecord record, List<MultipartFile> files, String category, String label)
            throws IOException {
        if (files == null) {
            return;
        }
        List<MultipartFile> uploaded = files.stream().filter(f -> f != null && !f.isEmpty()).toList();
        if (uploaded.size() > MAX_FILES_PER_TYPE) {
            throw new InvalidInputException(label + ": you can upload at most " + MAX_FILES_PER_TYPE + " files");
        }
        for (MultipartFile file : uploaded) {
            record.addAttachment(toAttachment(file, category, label));
        }
    }

    private static RecordAttachment toAttachment(MultipartFile file, String category, String label)
            throws IOException {
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String fileName = StringUtils.getFilename(StringUtils.cleanPath(original));
        if (fileName == null || fileName.isBlank()) {
            fileName = "file";
        }
        if (fileName.length() > 255) {
            fileName = fileName.substring(fileName.length() - 255); // keep the extension
        }
        if (!FileTypes.isAllowed(fileName)) {
            throw new InvalidInputException(label + " must be PDF, PNG, JPG or Word (doc, docx) files");
        }
        return new RecordAttachment(category, fileName, FileTypes.contentType(fileName), file.getBytes());
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
