package com.example.login.dto;

/** One uploaded file loaded on its own (so the other BLOBs of the row are not read). */
public record FileData(String fileName, byte[] data) {
}
