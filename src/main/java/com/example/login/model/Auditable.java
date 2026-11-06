package com.example.login.model;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;

import java.time.LocalDateTime;

/**
 * The four audit columns every table has:
 * <ul>
 *   <li>created_by / created_date: the user and the date-time when the row was inserted (set when it is saved).</li>
 *   <li>updated_by / updated_date: the user and the date-time of the last edit ({@link #touch(String)}).
 *       updated_date is also filled when the row is inserted; updated_by stays empty until the row is edited.</li>
 * </ul>
 * created_by and updated_by hold a user name from app_users (a foreign key is added at startup, see
 * ForeignKeyInitializer).
 */
@MappedSuperclass
public abstract class Auditable {

    @Column(name = "created_by", length = 50)
    private String createdBy;

    @Column(name = "created_date")
    private LocalDateTime createdDate;

    @Column(name = "updated_by", length = 50)
    private String updatedBy;

    @Column(name = "updated_date")
    private LocalDateTime updatedDate;

    @PrePersist
    void auditOnInsert() {
        LocalDateTime now = LocalDateTime.now();
        if (createdDate == null) {
            createdDate = now;
        }
        if (updatedDate == null) {
            updatedDate = now;
        }
    }

    /** Call when the row is edited: sets updated_by and updated_date. */
    public void touch(String user) {
        this.updatedBy = user;
        this.updatedDate = LocalDateTime.now();
    }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedDate() { return createdDate; }
    public void setCreatedDate(LocalDateTime createdDate) { this.createdDate = createdDate; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public LocalDateTime getUpdatedDate() { return updatedDate; }
    public void setUpdatedDate(LocalDateTime updatedDate) { this.updatedDate = updatedDate; }
}
