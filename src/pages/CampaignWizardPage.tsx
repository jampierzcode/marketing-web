import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useState } from "react";

export default function CampaignWizardPage() {
  const { id } = useParams();
  const restaurantId = Number(id);
  const qc = useQueryClient();

  const [objective, setObjective] = useState<
    "reservations" | "whatsapp" | "reach"
  >("reservations");
  const [dayToPush, setDayToPush] = useState<
    "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
  >("thu");
  const [budgetDaily, setBudgetDaily] = useState(300);
  const [zone, setZone] = useState("Roma/Condesa");
  const [duration, setDuration] = useState<"6s" | "10s" | "15s">("15s");
  const [videoMethod, setVideoMethod] = useState<
    "manual_capcut" | "canva_template" | "tiktok_symphony"
  >("manual_capcut");

  const [requestId, setRequestId] = useState<number | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [briefId, setBriefId] = useState<number | null>(null);

  const createReq = useMutation({
    mutationFn: async () => {
      const payload = {
        restaurantId,
        objective,
        dayToPush,
        budgetDaily,
        zone,
        duration,
        videoMethod,
      };
      return (await api.post("/campaign-requests", payload)).data as {
        id: number;
      };
    },
    onSuccess: async (data) => {
      setRequestId(data.id);
      await qc.invalidateQueries({
        queryKey: ["campaign-requests", restaurantId],
      });
    },
  });

  const ideas = useQuery({
    queryKey: ["ideas", requestId],
    queryFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/ideas`)).data as any[],
    enabled: !!requestId,
  });

  const selectIdea = useMutation({
    mutationFn: async (ideaId: number) =>
      (await api.post(`/campaign-ideas/${ideaId}/select`)).data as any,
    onSuccess: (data) => setSelectedIdeaId(data.id),
  });

  const generateBrief = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/brief`)).data as {
        id: number;
      },
    onSuccess: (data) => setBriefId(data.id),
  });

  const brief = useQuery({
    queryKey: ["brief", briefId],
    queryFn: async () =>
      (await api.get(`/creative-briefs/${briefId}`)).data as any,
    enabled: !!briefId,
  });

  return (
    <div>
      <h3>Crear campaña (MVP)</h3>

      {!requestId && (
        <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <label>
            Objetivo
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value as any)}
              style={{ width: "100%" }}
            >
              <option value="reservations">Reservas</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="reach">Alcance</option>
            </select>
          </label>

          <label>
            Día a impulsar
            <select
              value={dayToPush}
              onChange={(e) => setDayToPush(e.target.value as any)}
              style={{ width: "100%" }}
            >
              <option value="mon">Lun</option>
              <option value="tue">Mar</option>
              <option value="wed">Mié</option>
              <option value="thu">Jue</option>
              <option value="fri">Vie</option>
              <option value="sat">Sáb</option>
              <option value="sun">Dom</option>
            </select>
          </label>

          <label>
            Presupuesto diario (MXN)
            <input
              type="number"
              value={budgetDaily}
              onChange={(e) => setBudgetDaily(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Zona
            <input
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              style={{ width: "100%" }}
            />
          </label>

          <label>
            Duración
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value as any)}
              style={{ width: "100%" }}
            >
              <option value="6s">6s</option>
              <option value="10s">10s</option>
              <option value="15s">15s</option>
            </select>
          </label>

          <label>
            Método video
            <select
              value={videoMethod}
              onChange={(e) => setVideoMethod(e.target.value as any)}
              style={{ width: "100%" }}
            >
              <option value="manual_capcut">Manual (CapCut)</option>
              <option value="canva_template">Canva template</option>
              <option value="tiktok_symphony">TikTok Symphony</option>
            </select>
          </label>

          <button
            onClick={() => createReq.mutate()}
            disabled={createReq.isPending}
          >
            {createReq.isPending ? "Creando…" : "Crear solicitud"}
          </button>
        </div>
      )}

      {requestId && (
        <div>
          <p>
            Request ID: <b>{requestId}</b>
          </p>

          <h4>1) Ideas (elige 1)</h4>
          {ideas.isLoading && <p>Generando ideas…</p>}
          {ideas.data && (
            <div style={{ display: "grid", gap: 10 }}>
              {ideas.data.map((i) => (
                <div
                  key={i.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 12,
                    borderRadius: 8,
                  }}
                >
                  <b>{i.title}</b>
                  <p style={{ marginTop: 6 }}>{i.description}</p>
                  <p style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                    {i.rationale}
                  </p>
                  <button
                    onClick={() => selectIdea.mutate(i.id)}
                    disabled={selectIdea.isPending}
                  >
                    {selectedIdeaId === i.id
                      ? "Seleccionada ✅"
                      : "Seleccionar"}
                  </button>
                </div>
              ))}
            </div>
          )}

          <h4 style={{ marginTop: 16 }}>2) Brief (storyboard + receta)</h4>
          <button
            onClick={() => generateBrief.mutate()}
            disabled={!selectedIdeaId || generateBrief.isPending}
          >
            {generateBrief.isPending ? "Generando…" : "Generar brief"}
          </button>

          {brief.data && (
            <div
              style={{
                marginTop: 12,
                border: "1px solid #ddd",
                padding: 12,
                borderRadius: 8,
              }}
            >
              <h4 style={{ marginTop: 0 }}>Hook</h4>
              <p>{brief.data.hook}</p>

              <h4>CTA</h4>
              <p>{brief.data.cta}</p>

              <h4>Storyboard</h4>
              <ol>
                {brief.data.storyboard?.map((b: any, idx: number) => (
                  <li key={idx}>
                    <b>
                      {b.tStart}s–{b.tEnd}s
                    </b>{" "}
                    — {b.onScreen}
                    <div style={{ opacity: 0.8, fontSize: 13 }}>{b.shot}</div>
                  </li>
                ))}
              </ol>

              <h4>Receta CapCut</h4>
              <ol>
                {brief.data.capcutRecipe?.map((s: any, idx: number) => (
                  <li key={idx}>
                    <b>{s.clip}</b> ({s.duration}) — {s.onScreenText}
                    <div style={{ opacity: 0.8, fontSize: 13 }}>{s.notes}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
