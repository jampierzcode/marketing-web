import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useEffect, useState } from "react";

type Promo = { id: number; day: string; text: string };
type Restaurant = {
  id: number;
  name: string;
  city?: string | null;
  zone?: string | null;
  tone?: string | null;
  offers?: string | null;
  hours?: string | null;
  promos?: Promo[];
};

export default function RestaurantDetailPage() {
  const { id } = useParams();
  const restaurantId = Number(id);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["restaurant", restaurantId],
    queryFn: async () =>
      (await api.get<Restaurant>(`/restaurants/${restaurantId}`)).data,
    enabled: !!restaurantId,
  });

  const [promosText, setPromosText] = useState(
    "thu: Cumpleaños\nsat: Son cubano\nsun: Familiar"
  );

  useEffect(() => {
    if (q.data?.promos?.length) {
      const lines = q.data.promos.map((p) => `${p.day}: ${p.text}`);
      setPromosText(lines.join("\n"));
    }
  }, [q.data?.promos]);

  const savePromos = useMutation({
    mutationFn: async () => {
      const promos = promosText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [day, ...rest] = l.split(":");
          return { day: day.trim(), text: rest.join(":").trim() };
        });
      return (await api.post(`/restaurants/${restaurantId}/promos`, { promos }))
        .data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["restaurant", restaurantId] });
      alert("Promos guardadas");
    },
  });

  if (q.isLoading) return <p>Cargando…</p>;
  if (q.error) return <p>Error</p>;
  if (!q.data) return <p>No encontrado</p>;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>{q.data.name}</h3>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            {q.data.city ?? ""} {q.data.zone ? `— ${q.data.zone}` : ""}
          </div>
        </div>
        <Link to={`/restaurants/${restaurantId}/campaign`}>
          Crear campaña →
        </Link>
      </div>

      <hr />

      <h4>Promos por día (Brand Brain básico)</h4>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Formato: <code>thu: Cumpleaños</code> (uno por línea)
      </p>

      <textarea
        value={promosText}
        onChange={(e) => setPromosText(e.target.value)}
        rows={5}
        style={{ width: "100%", padding: 8 }}
      />

      <button
        onClick={() => savePromos.mutate()}
        disabled={savePromos.isPending}
      >
        {savePromos.isPending ? "Guardando…" : "Guardar promos"}
      </button>

      <h4 style={{ marginTop: 18 }}>Assets</h4>
      <p style={{ opacity: 0.8 }}>
        MVP: guardamos URL + tags (subida real después).
      </p>
      <AssetsPanel restaurantId={restaurantId} />
    </div>
  );
}

function AssetsPanel({ restaurantId }: { restaurantId: number }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"photo" | "video">("video");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("musica,cocteles,terraza");

  const assets = useQuery({
    queryKey: ["assets", restaurantId],
    queryFn: async () =>
      (await api.get(`/restaurants/${restaurantId}/assets`)).data as any[],
  });

  const add = useMutation({
    mutationFn: async () => {
      const payload = {
        type,
        url,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      return (await api.post(`/restaurants/${restaurantId}/assets`, payload))
        .data;
    },
    onSuccess: async () => {
      setUrl("");
      await qc.invalidateQueries({ queryKey: ["assets", restaurantId] });
    },
  });

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 8 }}>
      <div
        style={{
          display: "grid",
          gap: 8,
          gridTemplateColumns: "120px 1fr 1fr 120px",
        }}
      >
        <select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="video">video</option>
          <option value="photo">photo</option>
        </select>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="URL del asset (S3/local)"
        />
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="tags separados por coma"
        />
        <button onClick={() => add.mutate()} disabled={!url || add.isPending}>
          {add.isPending ? "Agregando…" : "Agregar"}
        </button>
      </div>

      <ul style={{ paddingLeft: 16 }}>
        {assets.data?.map((a) => (
          <li key={a.id}>
            <code>{a.type}</code> — {a.url}{" "}
            <span style={{ opacity: 0.7 }}>({(a.tags ?? []).join(", ")})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
