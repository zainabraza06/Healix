import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/authStore";
import toast from "react-hot-toast";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8080";

interface PatientAlert {
  alertId: string;
  patientId: string;
  doctorId: string;
  alert: {
    id: string;
    type: string;
    severity: string;
    title: string;
    message: string;
    timestamp: string;
  };
  patient: {
    id: string;
    name: string;
    email: string;
  };
}

export function usePatientAlerts(onAlertReceived?: (alert: PatientAlert) => void) {
  const { user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || user.role !== "DOCTOR") return;

    // Connect to socket server
    socketRef.current = io(SOCKET_URL, {
      auth: {
        token: localStorage.getItem("token"),
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // On connection, join the doctor room
    socketRef.current.on("connect", () => {
      console.log("Socket connected for doctor alerts");
      
      // Emit join event to join doctor room
      socketRef.current?.emit("join", {
        userId: user.id,
        role: "DOCTOR",
        doctorId: user.id,
      });
    });

    // Listen for patient alerts
    socketRef.current.on("patientAlert", (data: PatientAlert) => {
      console.log("Received patient alert:", data);

      // Show toast notification with custom content
      const severity = data.alert.severity;
      const severityColor =
        severity === "CRITICAL"
          ? "bg-red-600"
          : severity === "WARNING"
          ? "bg-amber-600"
          : "bg-blue-600";

      const severityEmoji =
        severity === "CRITICAL" ? "🔴" : severity === "WARNING" ? "⚠️" : "ℹ️";

      const message = `${severityEmoji} ${data.patient.name}: ${data.alert.title}`;
      
      toast.success(message, {
        duration: 10000,
        style: {
          background: severityColor,
          color: "white",
          fontWeight: "bold",
        },
      });

      // Trigger callback if provided
      onAlertReceived?.(data);
    });

    // Handle disconnect
    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user, onAlertReceived]);

  return socketRef.current;
}
