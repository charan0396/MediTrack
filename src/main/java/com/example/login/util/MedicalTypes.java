package com.example.login.util;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * The medical types offered in the dropdown of the record page. Keep this list and the options in record.html the same.
 * Older records saved before the dropdown existed may hold other text; they are shown as they are.
 */
public final class MedicalTypes {

    public static final List<String> ALL = List.of(
            "Pediatrician",
            "Neurologist",
            "Dermatologist",
            "Anesthesiologist",
            "Psychiatrist",
            "Gynecologist",
            "General Practitioner",
            "Dentist",
            "Family Doctor",
            "Surgeon",
            "Pulmonologist",
            "Veterinarian",
            "Cardiologist",
            "Epidemiologist",
            "Rheumatologist",
            "Urologist",
            "Optometrist",
            "Radiologist",
            "ENT Specialist",
            "Plastic Surgeon",
            "Diabetologist");

    private MedicalTypes() {
    }

    /** The listed type that equals the given text (ignoring upper/lower case and extra spaces), if any. */
    public static Optional<String> find(String value) {
        if (value == null) {
            return Optional.empty();
        }
        String wanted = value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
        return ALL.stream().filter(t -> t.toLowerCase(Locale.ROOT).equals(wanted)).findFirst();
    }
}
