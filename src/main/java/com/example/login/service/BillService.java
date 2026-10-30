package com.example.login.service;

import com.example.login.dto.BillRow;
import com.example.login.dto.FileData;
import com.example.login.model.Bill;
import com.example.login.repository.BillRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class BillService {

    private final BillRepository bills;

    public BillService(BillRepository bills) {
        this.bills = bills;
    }

    /** Saves the invoice and all of its products in one transaction (items are saved by cascade). */
    @Transactional
    public Bill save(Bill bill) {
        return bills.save(bill);
    }

    /** Product lines of one user's invoices, or of every user's when allUsers is true (super user). */
    @Transactional(readOnly = true)
    public List<BillRow> list(String owner, boolean allUsers) {
        return allUsers ? bills.findAllRows() : bills.findRowsByOwner(owner);
    }

    /** The captured bill image. Normal users can read only the images of their own invoices. */
    @Transactional(readOnly = true)
    public Optional<FileData> findImage(Long billId, String owner, boolean allUsers) {
        return allUsers ? bills.findImage(billId) : bills.findImageForOwner(billId, owner);
    }
}
