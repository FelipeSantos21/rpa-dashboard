package com.oneprocess.rpa.config;

import com.oneprocess.rpa.repository.RpaExecucaoFilaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
@RequiredArgsConstructor
@EnableScheduling
@Slf4j
public class RpaExecutionWebSocketHandler extends TextWebSocketHandler {

    private final RpaExecucaoFilaRepository repository;
    private final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();
    
    private String lastFingerprint = "";

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        // Force an initial update notification so the client populates immediately
        try {
            session.sendMessage(new TextMessage("update"));
        } catch (IOException e) {
            log.error("Failed to send initial update message: ", e);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) throws Exception {
        sessions.remove(session);
    }

    @Scheduled(fixedDelay = 2000)
    public void checkDatabaseUpdates() {
        if (sessions.isEmpty()) {
            return;
        }
        try {
            long count = repository.count();
            List<Object[]> rows = repository.findFingerprintData();
            
            StringBuilder sb = new StringBuilder();
            sb.append(count).append("_");
            if (rows != null) {
                for (Object[] row : rows) {
                    sb.append(row[0]).append(":").append(row[1]).append(";");
                }
            }
            String currentFingerprint = sb.toString();

            if (!currentFingerprint.equals(lastFingerprint)) {
                // If this is the first run, we only initialize lastFingerprint so we don't broadcast on boot/reboot
                if (!lastFingerprint.isEmpty()) {
                    broadcast("update");
                }
                lastFingerprint = currentFingerprint;
            }
        } catch (Exception e) {
            log.error("Error checking database updates: ", e);
        }
    }

    private void broadcast(String message) {
        for (WebSocketSession session : sessions) {
            if (session.isOpen()) {
                try {
                    session.sendMessage(new TextMessage(message));
                } catch (IOException e) {
                    log.error("Failed to send WebSocket message: ", e);
                }
            }
        }
    }
}
