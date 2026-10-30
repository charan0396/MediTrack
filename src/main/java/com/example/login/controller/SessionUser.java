package com.example.login.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

/** Reads the logged-in user's name from the server-side HTTP session. */
public final class SessionUser {

    public static final String KEY = "loggedInUser";

    private SessionUser() {
    }

    /** Returns the logged-in user name, or null when nobody is logged in (does not create a session). */
    public static String get(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object value = session.getAttribute(KEY);
        return value instanceof String s ? s : null;
    }
}
