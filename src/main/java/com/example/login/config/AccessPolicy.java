package com.example.login.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** Who is the super user (can see all records). Name comes from app.super-user.name. */
@Component
public class AccessPolicy {

    private final String superUserName;

    public AccessPolicy(@Value("${app.super-user.name:Thota}") String superUserName) {
        this.superUserName = superUserName;
    }

    public String superUserName() {
        return superUserName;
    }

    /** userName must be the name exactly as stored in the database. */
    public boolean isSuper(String userName) {
        return userName != null && userName.equals(superUserName);
    }

    /** Normal users may not register a name that looks like the super user. */
    public boolean isReserved(String name) {
        return name != null && name.trim().equalsIgnoreCase(superUserName);
    }
}
