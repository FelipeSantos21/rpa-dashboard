package com.oneprocess.rpa.config;

import com.oneprocess.rpa.repository.UsuarioPerfilRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class SecurityInterceptor implements HandlerInterceptor {

    private final UsuarioPerfilRepository usuarioPerfilRepository;

    @Value("${app.security.robot-token:op-robot-secret-2026}")
    private String robotToken;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();

        // 1. Allow login and documentation/H2 console routes
        if (path.startsWith("/api/auth/login") || 
            path.startsWith("/h2-console") || 
            path.startsWith("/swagger-ui") || 
            path.startsWith("/v3/api-docs")) {
            return true;
        }

        // 2. Protect telemetry webhooks (Robot endpoints)
        if (path.startsWith("/api/resultados/task") || path.startsWith("/api/resultados/subtask")) {
            String apiKey = request.getHeader("X-API-KEY");
            if (apiKey == null) {
                // Check Authorization header as fallback
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    apiKey = authHeader.substring(7);
                }
            }

            if (robotToken.equals(apiKey)) {
                return true;
            }
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"message\": \"Invalid or missing robot API key (X-API-KEY or Bearer token)\"}");
            return false;
        }

        // 3. Protect all other API endpoints (Dashboard consoles)
        if (path.startsWith("/api/")) {
            String authHeader = request.getHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                String token = authHeader.substring(7);
                try {
                    UUID userId = UUID.fromString(token);
                    if (usuarioPerfilRepository.existsById(userId)) {
                        return true;
                    }
                } catch (IllegalArgumentException e) {
                    // Invalid UUID format
                }
            }
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write("{\"message\": \"Unauthorized. Valid session token required.\"}");
            return false;
        }

        return true;
    }
}
