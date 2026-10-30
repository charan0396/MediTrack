package com.example.login.util;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Allowed upload types. The type served back is decided from the file extension, never from the client. */
public final class FileTypes {

    private static final Map<String, String> TYPES = Map.of(
            "pdf", "application/pdf",
            "png", "image/png",
            "jpg", "image/jpeg",
            "jpeg", "image/jpeg",
            "doc", "application/msword",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    /** Types a browser can show directly inside the preview popup. */
    private static final Set<String> INLINE = Set.of("pdf", "png", "jpg", "jpeg");

    private FileTypes() {
    }

    public static String extension(String fileName) {
        int dot = fileName.lastIndexOf('.');
        return dot < 0 ? "" : fileName.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public static boolean isAllowed(String fileName) {
        return TYPES.containsKey(extension(fileName));
    }

    public static String contentType(String fileName) {
        return TYPES.getOrDefault(extension(fileName), "application/octet-stream");
    }

    public static boolean isInline(String fileName) {
        return INLINE.contains(extension(fileName));
    }
}
