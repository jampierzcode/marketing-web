import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useState } from "react";

type Restaurant = {
  id: number;
  name: string;
  city?: string | null;
  zone?: string | null;
};

export default function RestaurantsPage() {
  const qc = useQueryClient();

  const [name, setName] = useState("Cantina Demo");
  const [city, setCity] = useState("CDMX");
  const [zone, setZone] = useState("Roma");
  const [tone, setTone] = useState("elegante");

  const q = useQuery({
    queryKey: ["restaurants"],
    queryFn: async () => (await api.get<Restaurant[]>("/restaurants")).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      const payload = { name, city, zone, tone };
      return (await api.post("/restaurants", payload)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["restaurants"] });
    },
  });

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Restaurantes</h3>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <b>Crear restaurante (MVP)</b>
        <div
          style={{
            display: "grid",
            gap: 8,
            gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
            marginTop: 8,
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ciudad"
          />
          <input
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            placeholder="Zona"
          />
          <input
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Tono"
          />
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim()}
          >
            {create.isPending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>

      {q.isLoading && <p>Cargando…</p>}
      {q.error && <p>Error cargando restaurantes.</p>}

      <ul style={{ paddingLeft: 16 }}>
        {q.data?.map((r) => (
          <li key={r.id}>
            <Link to={`/restaurants/${r.id}`}>{r.name}</Link>{" "}
            <span style={{ opacity: 0.7 }}>
              {r.city ? `— ${r.city}` : ""} {r.zone ? `(${r.zone})` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
