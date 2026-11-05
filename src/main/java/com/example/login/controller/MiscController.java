package com.example.login.controller;

import com.example.login.config.AccessPolicy;
import com.example.login.model.MiscEntry;
import com.example.login.repository.MiscEntryRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

/** Miscellaneous entries: date, name, description and amount. */
@RestController
@RequestMapping("/api/misc")
public class MiscController {

    /** Largest amount that fits the database column (16 digits, 2 decimals). */
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("99999999999999.99");

    private final MiscEntryRepository entries;
    private final AccessPolicy accessPolicy;

    public MiscController(MiscEntryRepository entries, AccessPolicy accessPolicy) {
        this.entries = entries;
        this.accessPolicy = accessPolicy;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            HttpServletRequest http,
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String amount) {

        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }

        MiscEntry entry = new MiscEntry();
        entry.setOwnerName(owner);
        entry.setMiscDate(parseDate(date));
        entry.setName(required(name, 100, "Name"));
        entry.setDescription(optional(description, 500, "Description"));
        entry.setAmount(parseAmount(amount));
        // recorded_date is filled automatically with today's date

        MiscEntry saved = entries.save(entry);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("success", true, "message", "Saved successfully", "id", saved.getId()));
    }

    /** The logged-in user's entries, or everyone's for the super user. */
    @GetMapping
    public ResponseEntity<Object> list(HttpServletRequest http) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(accessPolicy.isSuper(owner) ? entries.findAllRows() : entries.findRowsByOwner(owner));
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

    /** A plain number with at most 2 decimals kept (extra decimals are rounded half up). */
    private static BigDecimal parseAmount(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new InvalidInputException("Amount is required");
        }
        String cleaned = raw.trim().replace(",", "").replace(" ", "");
        if (cleaned.length() > 20 || !cleaned.matches("\\d+(\\.\\d+)?")) {
            throw new InvalidInputException("Amount must be a number");
        }
        BigDecimal value = new BigDecimal(cleaned).setScale(2, RoundingMode.HALF_UP);
        if (value.signum() <= 0) {
            throw new InvalidInputException("Amount must be more than 0");
        }
        if (value.compareTo(MAX_AMOUNT) > 0) {
            throw new InvalidInputException("Amount is too large");
        }
        return value;
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
