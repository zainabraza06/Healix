"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Send, Loader } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/apiClient";

interface CreateAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  doctors: any[];
  onAlertCreated?: () => void;
}

export default function CreateAlertModal({
  isOpen,
  onClose,
  doctors,
  onAlertCreated,
}: CreateAlertModalProps) {
  const [severity, setSeverity] = useState<"CRITICAL" | "WARNING" | "INFO">(
    "WARNING"
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter an alert title");
      return;
    }

    if (!message.trim()) {
      toast.error("Please describe your health concern");
      return;
    }

    if (!selectedDoctorId) {
      toast.error("Please select a doctor");
      return;
    }

    setIsLoading(true);
    try {
      // Map alert type to proper severity level
      const severityMapping = {
        CRITICAL: 'HIGH',
        WARNING: 'MEDIUM',
        INFO: 'LOW'
      };
      
      const response = await apiClient.createPatientAlert({
        doctorId: selectedDoctorId,
        alertType: severity, // CRITICAL, WARNING, or INFO
        severity: severityMapping[severity], // LOW, MEDIUM, or HIGH
        title,
        message,
      });

      if (response.success) {
        toast.success("Alert sent to doctor successfully!");
        resetForm();
        onClose();
        onAlertCreated?.();
      } else {
        toast.error(response.message || "Failed to send alert");
      }
    } catch (error: any) {
      console.error("Error creating alert:", error);
      toast.error(
        error.response?.data?.message || "Failed to send alert to doctor"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setSeverity("WARNING");
    setSelectedDoctorId("");
  };

  const severityColors = {
    CRITICAL: "bg-red-50 border-red-200 text-red-700",
    WARNING: "bg-amber-50 border-amber-200 text-amber-700",
    INFO: "bg-blue-50 border-blue-200 text-blue-700",
  };

  const severityBgButton = {
    CRITICAL:
      "bg-red-600 hover:bg-red-700 focus:ring-red-300 shadow-red-100",
    WARNING:
      "bg-amber-600 hover:bg-amber-700 focus:ring-amber-300 shadow-amber-100",
    INFO: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-300 shadow-blue-100",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[300] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg rounded-[2rem] border border-slate-100/80 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] overflow-hidden relative"
          >
            {/* Header */}
            <div className="relative p-6 bg-gradient-to-br from-slate-50 to-white border-b border-slate-100">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Create Health Alert
                  </h2>
                  <p className="text-sm text-slate-500 font-semibold mt-1">
                    Send urgent health information to your doctor
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Alert Severity */}
              <div>
                <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                  Alert Severity
                </label>
                <div className="flex gap-3">
                  {(["CRITICAL", "WARNING", "INFO"] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSeverity(level)}
                      className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all border-2 ${
                        severity === level
                          ? level === "CRITICAL"
                            ? "bg-red-600 text-white border-red-600"
                            : level === "WARNING"
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-blue-600 text-white border-blue-600"
                          : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alert Title */}
              <div>
                <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                  Alert Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., High Blood Pressure, Chest Pain, etc."
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-400 transition-all font-semibold text-slate-900 placeholder:text-slate-400"
                />
              </div>

              {/* Alert Message */}
              <div>
                <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                  Details & Symptoms
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your symptoms, readings, and when they started..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-400 transition-all font-semibold text-slate-900 placeholder:text-slate-400 resize-none"
                />
              </div>

              {/* Select Doctor */}
              <div>
                <label className="block text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                  Select Doctor
                </label>
                {doctors.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-center">
                    <p className="text-sm text-slate-500 font-semibold">
                      No doctors available
                    </p>
                  </div>
                ) : (
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-slate-400 transition-all font-semibold text-slate-900"
                  >
                    <option value="">Choose a doctor...</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        Dr. {doctor.name} — {doctor.specialization || "General"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Severity Warning */}
              {severity === "CRITICAL" && (
                <div
                  className={`p-4 rounded-xl border-2 ${severityColors[severity]} bg-red-50 border-red-200`}
                >
                  <p className="text-sm font-bold">
                    ⚠️ Critical alerts will get immediate attention from your
                    doctor
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 bg-white text-slate-700 font-black uppercase tracking-wider text-xs rounded-xl border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`flex-1 py-3 px-4 text-white font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-2 transition-all ${
                    severityBgButton[severity]
                  } ${
                    isLoading ? "opacity-70 cursor-not-allowed" : ""
                  } shadow-lg`}
                >
                  {isLoading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Alert
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
