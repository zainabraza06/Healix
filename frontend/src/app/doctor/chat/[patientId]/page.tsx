'use client';

import ProtectedLayout from '@/components/ProtectedLayout';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/apiClient';
import { connectSocket, joinRooms, onChatReceive, offChatReceive } from '@/lib/socket';
import { useAuthStore } from '@/lib/authStore';
import { Send } from 'lucide-react';

export default function DoctorChatPage() {
  const params = useParams();
  const { user } = useAuthStore();
  const patientId = params?.patientId as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      const res = await apiClient.getDoctorChatHistory(patientId);
      if (res.success) setMessages(res.data || []);
    })();
  }, [patientId]);

  useEffect(() => {
    if (!user) return;
    connectSocket(localStorage.getItem('token') || undefined);
    joinRooms({ role: 'DOCTOR', doctorId: user.id, userId: user.id });

    const handler = (payload: any) => {
      if (payload?.patientId === patientId) {
        setMessages((prev) => [...prev, payload.message]);
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    onChatReceive(handler);
    return () => offChatReceive(handler);
  }, [user, patientId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim()) return;
    const res = await apiClient.sendDoctorChatMessage(patientId, input.trim());
    if (res.success) {
      setMessages((prev) => [...prev, { text: input.trim(), sender_role: 'DOCTOR', created_at: new Date().toISOString() }]);
      setInput('');
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <ProtectedLayout allowedRoles={['DOCTOR']}>
      <div className="container-main py-6">
        <div className="glass-card p-4 h-[70vh] flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-2">
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[70%] p-3 rounded-xl ${m.sender_role === 'DOCTOR' ? 'bg-emerald-100 ml-auto' : 'bg-slate-100'}`}>
                <p className="text-slate-800">{m.text}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(m.created_at || Date.now()).toLocaleTimeString()}</p>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message"
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl"
            />
            <button onClick={send} className="px-4 py-2 bg-emerald-600 text-white rounded-xl flex items-center gap-2">
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      </div>
    </ProtectedLayout>
  );
}
