package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.LocalDate;

@Entity
@Table(name = "app_users")
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    // Stored as a BCrypt hash, never plain text
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    /** Set automatically (today's date) when the user is created. */
    @Column(name = "created_date")
    private LocalDate createdDate;

    /** Set only when the user resets the password. Empty until then. */
    @Column(name = "updated_date")
    private LocalDate updatedDate;

    public AppUser() {
    }

    public AppUser(String name, String passwordHash) {
        this.name = name;
        this.passwordHash = passwordHash;
    }

    @PrePersist
    void onCreate() {
        if (createdDate == null) {
            createdDate = LocalDate.now();
        }
    }

    public Long getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public LocalDate getCreatedDate() { return createdDate; }
    public void setCreatedDate(LocalDate createdDate) { this.createdDate = createdDate; }

    public LocalDate getUpdatedDate() { return updatedDate; }
    public void setUpdatedDate(LocalDate updatedDate) { this.updatedDate = updatedDate; }
}
