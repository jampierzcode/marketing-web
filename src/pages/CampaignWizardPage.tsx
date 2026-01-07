import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Steps,
  Typography,
} from "antd";

const { Title, Text } = Typography;

export default function CampaignWizardPage() {
  const { id } = useParams();
  const restaurantId = Number(id);

  const [requestId, setRequestId] = useState<number | null>(null);
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [brief, setBrief] = useState<any | null>(null);

  const [videoJob, setVideoJob] = useState<any | null>(null);
  const [videoStatus, setVideoStatus] = useState<any | null>(null);

  const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:3333/api";
  const downloadUrl = useMemo(() => {
    if (!videoJob?.id) return null;
    return `${apiBase}/videos/${videoJob.id}/content`;
  }, [videoJob, apiBase]);

  const createReq = useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/campaign-requests", payload)).data as { id: number },
    onSuccess: (data) => setRequestId(data.id),
  });

  const generateIdeas = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/ideas`)).data as any[],
    onSuccess: (data) => {
      setIdeas(data);
      setSelectedIdeaId(null);
      setBrief(null);
      setVideoJob(null);
      setVideoStatus(null);
    },
  });

  const selectIdea = useMutation({
    mutationFn: async (ideaId: number) =>
      (await api.post(`/campaign-ideas/${ideaId}/select`)).data,
    onSuccess: (data) => setSelectedIdeaId(data.id),
  });

  const generateBrief = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/brief`)).data,
    onSuccess: (data) => setBrief(data),
  });

  const createVideo = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/video`)).data,
    onSuccess: (data) => {
      setVideoJob(data);
      setVideoStatus(data);
    },
  });

  // Poll video status
  useEffect(() => {
    if (!videoJob?.id) return;
    const t = setInterval(async () => {
      try {
        const res = await api.get(`/videos/${videoJob.id}`);
        setVideoStatus(res.data);
        if (res.data.status === "completed" || res.data.status === "failed") {
          clearInterval(t);
        }
      } catch {
        // ignore transient
      }
    }, 2500);
    return () => clearInterval(t);
  }, [videoJob?.id]);

  return (
    <div>
      <Title level={3}>Crear campaña (MVP)</Title>

      {!requestId && (
        <Card>
          <Form
            layout="vertical"
            onFinish={(values) => {
              createReq.mutate({
                restaurantId,
                objective: values.objective,
                dayToPush: values.dayToPush,
                budgetDaily: values.budgetDaily,
                zone: values.zone,
                duration: values.duration,
                videoMethod: values.videoMethod,
              });
            }}
            initialValues={{
              objective: "reservations",
              dayToPush: "thu",
              budgetDaily: 300,
              zone: "Roma/Condesa",
              duration: "15s",
              videoMethod: "manual_capcut",
            }}
          >
            <Form.Item
              name="objective"
              label="Objetivo"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "reservations", label: "Reservas" },
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "reach", label: "Alcance" },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="dayToPush"
              label="Día a impulsar"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "mon", label: "Lun" },
                  { value: "tue", label: "Mar" },
                  { value: "wed", label: "Mié" },
                  { value: "thu", label: "Jue" },
                  { value: "fri", label: "Vie" },
                  { value: "sat", label: "Sáb" },
                  { value: "sun", label: "Dom" },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="budgetDaily"
              label="Presupuesto diario (MXN)"
              rules={[{ required: true }]}
            >
              <InputNumber style={{ width: "100%" }} min={1} />
            </Form.Item>

            <Form.Item name="zone" label="Zona">
              <Input />
            </Form.Item>

            <Form.Item
              name="duration"
              label="Duración"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "6s", label: "6s" },
                  { value: "10s", label: "10s" },
                  { value: "15s", label: "15s" },
                ]}
              />
            </Form.Item>

            <Form.Item
              name="videoMethod"
              label="Método video"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: "manual_capcut", label: "Manual (CapCut)" },
                  { value: "canva_template", label: "Canva template" },
                  { value: "tiktok_symphony", label: "TikTok Symphony" },
                ]}
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              loading={createReq.isPending}
            >
              Crear solicitud
            </Button>
          </Form>
        </Card>
      )}

      {requestId && (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Alert type="info" message={`Request ID: ${requestId}`} />

          <Steps
            current={
              !ideas
                ? 0
                : !selectedIdeaId
                ? 1
                : !brief
                ? 2
                : !videoJob
                ? 3
                : videoStatus?.status === "completed"
                ? 4
                : 3
            }
            items={[
              { title: "Generar ideas" },
              { title: "Seleccionar idea" },
              { title: "Generar brief" },
              { title: "Crear video" },
              { title: "Descargar" },
            ]}
          />

          <Card
            title="1) Ideas"
            extra={
              <Button
                type="primary"
                onClick={() => generateIdeas.mutate()}
                disabled={!requestId}
                loading={generateIdeas.isPending}
              >
                Generar ideas con OpenAI
              </Button>
            }
          >
            {generateIdeas.isPending && (
              <Space>
                <Spin />
                <Text>OpenAI creando ideas…</Text>
              </Space>
            )}

            {ideas?.length ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                {ideas.map((i) => (
                  <Card key={i.id} type="inner" title={i.title}>
                    <Text>{i.description}</Text>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">{i.rationale}</Text>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Button
                        onClick={() => selectIdea.mutate(i.id)}
                        loading={
                          selectIdea.isPending && selectedIdeaId !== i.id
                        }
                        type={selectedIdeaId === i.id ? "primary" : "default"}
                      >
                        {selectedIdeaId === i.id
                          ? "Seleccionada ✅"
                          : "Seleccionar"}
                      </Button>
                    </div>
                  </Card>
                ))}
              </Space>
            ) : (
              <Text type="secondary">Genera ideas para ver opciones.</Text>
            )}
          </Card>

          <Card
            title="2) Brief (Storyboard + receta)"
            extra={
              <Button
                type="primary"
                onClick={() => generateBrief.mutate()}
                disabled={!selectedIdeaId}
                loading={generateBrief.isPending}
              >
                Generar brief con OpenAI
              </Button>
            }
          >
            {generateBrief.isPending && (
              <Space>
                <Spin />
                <Text>OpenAI creando storyboard…</Text>
              </Space>
            )}

            {brief && (
              <>
                <Title level={5}>Hook</Title>
                <Text>{brief.hook}</Text>

                <Title level={5} style={{ marginTop: 12 }}>
                  CTA
                </Title>
                <Text>{brief.cta}</Text>

                <Title level={5} style={{ marginTop: 12 }}>
                  Storyboard
                </Title>
                <ol>
                  {brief.storyboard?.map((b: any, idx: number) => (
                    <li key={idx}>
                      <b>
                        {b.tStart}s–{b.tEnd}s
                      </b>{" "}
                      — {b.onScreen}
                      <div style={{ opacity: 0.85 }}>{b.shot}</div>
                    </li>
                  ))}
                </ol>

                <Title level={5} style={{ marginTop: 12 }}>
                  Receta CapCut
                </Title>
                <ol>
                  {brief.capcutRecipe?.map((s: any, idx: number) => (
                    <li key={idx}>
                      <b>{s.clip}</b> ({s.duration}) — {s.onScreenText}
                      <div style={{ opacity: 0.85 }}>{s.notes}</div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </Card>

          <Card
            title="3) Video (OpenAI / Sora)"
            extra={
              <Button
                type="primary"
                onClick={() => createVideo.mutate()}
                disabled={!brief}
                loading={createVideo.isPending}
              >
                Crear video con OpenAI
              </Button>
            }
          >
            {createVideo.isPending && (
              <Space>
                <Spin />
                <Text>OpenAI creando video…</Text>
              </Space>
            )}

            {videoStatus?.id && (
              <div>
                <Text>
                  Video Job: <b>{videoStatus.id}</b> — status:{" "}
                  <b>{videoStatus.status}</b>
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    progress: {videoStatus.progress ?? 0}%
                  </Text>
                </div>
              </div>
            )}

            {videoStatus?.status === "completed" && downloadUrl && (
              <div style={{ marginTop: 12 }}>
                <Button type="primary" href={downloadUrl} target="_blank">
                  Descargar MP4
                </Button>
              </div>
            )}

            {videoStatus?.status === "failed" && (
              <Alert
                type="error"
                message="Falló la generación del video. Revisa logs del backend."
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        </Space>
      )}
    </div>
  );
}
