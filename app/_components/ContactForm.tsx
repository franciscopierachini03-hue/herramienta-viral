"use client";

import { useState } from "react";

const CONSULTATION_TYPES = [
  "Conferencia / Keynote",
  "Evento Corporativo",
  "Mentoría",
  "Colaboración",
  "Medios",
  "Otro",
];

interface FormState {
  name: string;
  email: string;
  whatsapp: string;
  company: string;
  type: string;
  message: string;
}

type SubmitStatus = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    whatsapp: "",
    company: "",
    type: "",
    message: "",
  });
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [error, setError] = useState("");

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al enviar");
      }

      setStatus("success");
      setForm({ name: "", email: "", whatsapp: "", company: "", type: "", message: "" });
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Error al enviar el formulario.");
    }
  }

  const inputClass =
    "w-full bg-[#0D0D1A] border border-[#1E1E35] rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#3A3A58] focus:outline-none focus:border-[#8B5CF6] focus:ring-1 focus:ring-[#8B5CF6]/30 transition-all";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs text-[#6B6B8A] mb-2 uppercase tracking-wider">
            Nombre *
          </label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="Tu nombre"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-[#6B6B8A] mb-2 uppercase tracking-wider">
            Email *
          </label>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="tu@email.com"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className="block text-xs text-[#6B6B8A] mb-2 uppercase tracking-wider">
            WhatsApp <span className="normal-case text-[#3A3A58]">(opcional)</span>
          </label>
          <input
            name="whatsapp"
            type="tel"
            value={form.whatsapp}
            onChange={handleChange}
            placeholder="+54 9 11 0000-0000"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-[#6B6B8A] mb-2 uppercase tracking-wider">
            Empresa / Proyecto
          </label>
          <input
            name="company"
            value={form.company}
            onChange={handleChange}
            placeholder="Nombre de tu empresa"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#6B6B8A] mb-2 uppercase tracking-wider">
          Tipo de consulta *
        </label>
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          required
          className={`${inputClass} appearance-none cursor-pointer`}
        >
          <option value="" disabled>
            Selecciona una opción
          </option>
          {CONSULTATION_TYPES.map((t) => (
            <option key={t} value={t} className="bg-[#0D0D1A]">
              {t}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-[#6B6B8A] mb-2 uppercase tracking-wider">
          Mensaje *
        </label>
        <textarea
          name="message"
          value={form.message}
          onChange={handleChange}
          required
          rows={5}
          placeholder="Cuéntame sobre tu proyecto, evento o consulta..."
          className={`${inputClass} resize-none`}
        />
      </div>

      {status === "error" && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {status === "success" ? (
        <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl p-5 text-center">
          <p className="text-[#A78BFA] font-medium">✓ Mensaje enviado con éxito</p>
          <p className="text-[#6B6B8A] text-sm mt-1">Te respondo pronto.</p>
        </div>
      ) : (
        <button
          type="submit"
          disabled={status === "loading"}
          className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-all duration-200 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)]"
        >
          {status === "loading" ? "Enviando..." : "Enviar mensaje"}
        </button>
      )}
    </form>
  );
}
