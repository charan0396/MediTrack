package com.example.login.repository;

import com.example.login.model.DeletedBill;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeletedBillRepository extends JpaRepository<DeletedBill, Long> {
}
