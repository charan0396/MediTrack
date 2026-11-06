package com.example.login.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Every table has a primary key (id). The links between tables are real foreign keys:
 * bill_items.bill_id -> bills, deleted_bill_items.deleted_bill_id -> deleted_bills,
 * record_attachments.record_id -> medical_records (created by the entity mappings), and, added here at startup,
 * created_by and updated_by of every table -> app_users.name.
 * A foreign key that already exists is skipped. If one cannot be added (for example old rows hold a user name that
 * is not in app_users) a warning is logged and the application keeps running.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class ForeignKeyInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ForeignKeyInitializer.class);

    private static final List<String> TABLES = List.of(
            "medical_records", "record_attachments", "bills", "bill_items",
            "deleted_bills", "deleted_bill_items", "medicines", "miscellaneous");
    private static final List<String> USER_COLUMNS = List.of("created_by", "updated_by");

    private final JdbcTemplate jdbc;

    public ForeignKeyInitializer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        for (String table : TABLES) {
            Set<String> existing = foreignKeyColumns(table);
            for (String column : USER_COLUMNS) {
                if (existing.contains(column)) {
                    continue;
                }
                String sql = "ALTER TABLE " + table + " ADD CONSTRAINT fk_" + table + "_" + column
                        + " FOREIGN KEY (" + column + ") REFERENCES app_users (name)";
                try {
                    jdbc.execute(sql);
                    log.info("Foreign key added: {}.{} -> app_users.name", table, column);
                } catch (DataAccessException e) {
                    log.warn("Could not add foreign key {}.{} -> app_users.name: {}", table, column, e.getMostSpecificCause().getMessage());
                }
            }
        }
    }

    /** Columns of the table that already have a foreign key (lower case). */
    private Set<String> foreignKeyColumns(String table) {
        try {
            return jdbc.execute((ConnectionCallback<Set<String>>) con -> {
                Set<String> columns = new HashSet<>();
                try (ResultSet rs = con.getMetaData().getImportedKeys(con.getCatalog(), null, table)) {
                    while (rs.next()) {
                        columns.add(rs.getString("FKCOLUMN_NAME").toLowerCase(Locale.ROOT));
                    }
                }
                return columns;
            });
        } catch (DataAccessException e) {
            return Set.of();
        }
    }
}
