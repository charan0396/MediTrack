package com.example.login.dto;

/** Metadata of one uploaded file (no bytes). The id is used to open or download the file. */
public record FileRef(Long id, Long recordId, String category, String fileName) {
}
