package com.example.login.controller;

import com.example.login.config.AccessPolicy;
import com.example.login.dto.FileData;
import com.example.login.model.Bill;
import com.example.login.model.BillItem;
import com.example.login.service.BillService;
import com.example.login.util.FileTypes;
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
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Saves an invoice (bill) with all of its products and the captured bill image. */
@RestController
@RequestMapping("/api/bills")
public class BillController {

    private static final int MAX_PRODUCTS = 50;
    private static final BigDecimal MAX_QUANTITY = new BigDecimal("100000");
    private static final BigDecimal MAX_PRICE = new BigDecimal("10000000");
    /** The text on the bill is read in the browser, so only pictures are accepted as the captured bill. */
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("png", "jpg", "jpeg");

    private final BillService billService;
    private final AccessPolicy accessPolicy;

    public BillController(BillService billService, AccessPolicy accessPolicy) {
        this.billService = billService;
        this.accessPolicy = accessPolicy;
    }

    /**
     * Save one invoice. The products arrive as parallel lists (product[i], quantity[i], price[i]).
     * Quantity x price of every product and the invoice total are calculated here, never trusted from the page.
     */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> create(
            HttpServletRequest http,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String billDate,
            @RequestParam(required = false) String medicalShop,
            @RequestParam(required = false) String invoiceNumber,
            @RequestParam(required = false) MultipartFile image) throws IOException {

        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }

        Bill bill = new Bill();
        bill.setOwnerName(owner);
        bill.setName(billName(name, owner, accessPolicy.isSuper(owner)));
        bill.setBillDate(parseDate(billDate));
        bill.setMedicalShop(optional(medicalShop, 150, "Medical shop"));
        bill.setInvoiceNumber(optional(invoiceNumber, 50, "Invoice number"));
        // recorded_date is filled automatically with today's date when the invoice is saved

        // Read the raw values: a single value containing commas must not be split into several products
        BigDecimal total = addProducts(bill,
                http.getParameterValues("product"),
                http.getParameterValues("quantity"),
                http.getParameterValues("price"));
        bill.setTotalAmount(total);

        addImage(bill, image);

        Bill saved = billService.save(bill);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("message", "Invoice saved successfully");
        body.put("id", saved.getId());
        body.put("products", saved.getItems().size());
        body.put("totalAmount", saved.getTotalAmount());
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    /**
     * Saved invoices for the "Saved bills" table: one row per product, the logged-in user's own invoices,
     * or every invoice for the super user. Image names only, no image bytes.
     */
    @GetMapping
    public ResponseEntity<Object> list(HttpServletRequest http) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Please log in again"));
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .body(billService.list(owner, accessPolicy.isSuper(owner)));
    }

    /** The captured bill image of one invoice. Add ?download=true to force a download. */
    @GetMapping("/{billId}/image")
    public ResponseEntity<byte[]> image(HttpServletRequest http,
                                        @PathVariable Long billId,
                                        @RequestParam(defaultValue = "false") boolean download) {
        String owner = SessionUser.get(http);
        if (owner == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        Optional<FileData> found = billService.findImage(billId, owner, accessPolicy.isSuper(owner));
        if (found.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        FileData file = found.get();
        ContentDisposition disposition = (download ? ContentDisposition.attachment() : ContentDisposition.inline())
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

    // ---------- products ----------

    /** Adds every non-blank product row to the bill and returns the sum of the line totals. */
    private static BigDecimal addProducts(Bill bill, String[] products, String[] quantities, String[] prices) {
        int rows = Math.max(len(products), Math.max(len(quantities), len(prices)));
        if (rows > MAX_PRODUCTS) {
            throw new InvalidInputException("An invoice can have at most " + MAX_PRODUCTS + " products");
        }

        BigDecimal total = BigDecimal.ZERO;
        for (int i = 0; i < rows; i++) {
            String product = at(products, i);
            String quantity = at(quantities, i);
            String price = at(prices, i);
            if (isBlank(product) && isBlank(quantity) && isBlank(price)) {
                continue; // an empty row on the page
            }

            String label = "Product " + (i + 1);
            String productName = required(product, 200, label + ": product name");
            BigDecimal qty = amount(quantity, label + ": quantity");
            BigDecimal unitPrice = amount(price, label + ": price");
            if (qty.signum() <= 0) {
                throw new InvalidInputException(label + ": quantity must be more than 0");
            }
            if (qty.compareTo(MAX_QUANTITY) > 0) {
                throw new InvalidInputException(label + ": quantity is too large");
            }
            if (unitPrice.compareTo(MAX_PRICE) > 0) {
                throw new InvalidInputException(label + ": price is too large");
            }

            BigDecimal lineTotal = qty.multiply(unitPrice).setScale(2, RoundingMode.HALF_UP);
            bill.addItem(new BillItem(productName, qty, unitPrice, lineTotal));
            total = total.add(lineTotal);
        }

        if (bill.getItems().isEmpty()) {
            throw new InvalidInputException("Add at least one product");
        }
        return total;
    }

    // ---------- captured bill image ----------

    private static void addImage(Bill bill, MultipartFile image) throws IOException {
        if (image == null || image.isEmpty()) {
            return;
        }
        String original = image.getOriginalFilename() == null ? "" : image.getOriginalFilename();
        String fileName = StringUtils.getFilename(StringUtils.cleanPath(original));
        if (fileName == null || fileName.isBlank()) {
            fileName = "bill.png";
        }
        if (fileName.length() > 255) {
            fileName = fileName.substring(fileName.length() - 255); // keep the extension
        }
        if (!IMAGE_EXTENSIONS.contains(FileTypes.extension(fileName))) {
            throw new InvalidInputException("The bill image must be a PNG or JPG picture");
        }
        bill.setBillFileName(fileName);
        bill.setBillContentType(FileTypes.contentType(fileName));
        bill.setBillImage(image.getBytes());
    }

    // ---------- helpers ----------

    /**
     * Same rule as the record page: the super user may save a bill for any name,
     * every other user only for their own user name.
     */
    private static String billName(String submitted, String owner, boolean superUser) {
        if (superUser) {
            return required(submitted, 100, "Name");
        }
        String value = optional(submitted, 100, "Name");
        if (value != null && !value.equalsIgnoreCase(owner)) {
            throw new InvalidInputException("You can add bills only for your own name (" + owner + ")");
        }
        return owner;
    }

    private static LocalDate parseDate(String date) {
        if (isBlank(date)) {
            throw new InvalidInputException("Bill date is required");
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            throw new InvalidInputException("Bill date is invalid");
        }
    }

    /** A plain number with at most 2 decimals kept (extra decimals are rounded half up). */
    private static BigDecimal amount(String raw, String label) {
        if (isBlank(raw)) {
            throw new InvalidInputException(label + " is required");
        }
        String cleaned = raw.trim().replace(",", "").replace(" ", "");
        if (cleaned.length() > 20 || !cleaned.matches("\\d+(\\.\\d+)?")) {
            throw new InvalidInputException(label + " must be a number");
        }
        return new BigDecimal(cleaned).setScale(2, RoundingMode.HALF_UP);
    }

    private static String required(String value, int max, String label) {
        String v = optional(value, max, label);
        if (v == null) {
            throw new InvalidInputException(label + " is required");
        }
        return v;
    }

    private static String optional(String value, int max, String label) {
        if (isBlank(value)) {
            return null;
        }
        String v = value.trim();
        if (v.length() > max) {
            throw new InvalidInputException(label + " must be at most " + max + " characters");
        }
        return v;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static int len(String[] values) {
        return values == null ? 0 : values.length;
    }

    private static String at(String[] values, int index) {
        return values != null && index < values.length ? values[index] : null;
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
