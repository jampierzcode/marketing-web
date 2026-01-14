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

  // Vertex video
  const [operationName, setOperationName] = useState<string | null>(null);
  const [videoDone, setVideoDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [videoRaw, setVideoRaw] = useState<any | null>(null);

  // const apiBase = import.meta.env.VITE_API_BASE || "http://localhost:3333/api";

  const createReq = useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/campaign-requests", payload)).data as { id: number },
    onSuccess: (data) => {
      setRequestId(data.id);
      // reset flow
      setIdeas(null);
      setSelectedIdeaId(null);
      setBrief(null);
      setOperationName(null);
      setVideoDone(false);
      setDownloadUrl(null);
      setVideoRaw(null);
    },
  });

  const generateIdeas = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/ideas`)).data as any[],
    onSuccess: (data) => {
      setIdeas(data);
      setSelectedIdeaId(null);
      setBrief(null);
      setOperationName(null);
      setVideoDone(false);
      setDownloadUrl(null);
      setVideoRaw(null);
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
    onSuccess: (data) => {
      setBrief(data);
      setOperationName(null);
      setVideoDone(false);
      setDownloadUrl(null);
      setVideoRaw(null);
    },
  });

  // Aquí es donde el backend hace: Nano Banana (imagen) + Veo (video)
  const createVertexVideo = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/video`)).data as {
        operationName: string;
      },
    onSuccess: (data) => {
      setOperationName(data.operationName);
      setVideoDone(false);
      setDownloadUrl(null);
      setVideoRaw(null);
    },
  });

  // polling status
  useEffect(() => {
    if (!operationName) return;

    const encoded = encodeURIComponent(operationName);
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await api.get(`/videos/veo/${encoded}/status`);
        if (cancelled) return;

        setVideoRaw(res.data);

        if (res.data.done) {
          setVideoDone(true);
          if (res.data.downloadUrl) setDownloadUrl(res.data.downloadUrl);
          return;
        }

        // sigue poll
        setTimeout(tick, 5000);
      } catch {
        // reintenta
        if (!cancelled) setTimeout(tick, 7000);
      }
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [operationName]);

  const currentStep = useMemo(() => {
    if (!requestId) return 0;
    if (!ideas) return 1;
    if (!selectedIdeaId) return 2;
    if (!brief) return 3;
    if (!operationName) return 4;
    if (!videoDone) return 4;
    return 5;
  }, [requestId, ideas, selectedIdeaId, brief, operationName, videoDone]);

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
            current={currentStep}
            items={[
              { title: "Crear request" },
              { title: "Generar ideas" },
              { title: "Elegir idea" },
              { title: "Storyboard" },
              { title: "Video (Nano+Veo)" },
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
                Generar ideas
              </Button>
            }
          >
            {generateIdeas.isPending && (
              <Space>
                <Spin />
                <Text>Generando ideas…</Text>
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
                        loading={selectIdea.isPending}
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
            title="2) Storyboard / Brief"
            extra={
              <Button
                type="primary"
                onClick={() => generateBrief.mutate()}
                disabled={!selectedIdeaId}
                loading={generateBrief.isPending}
              >
                Generar storyboard
              </Button>
            }
          >
            {generateBrief.isPending && (
              <Space>
                <Spin />
                <Text>Generando storyboard…</Text>
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
            title="3) Video (Nano Banana + Veo en Vertex)"
            extra={
              <Button
                type="primary"
                onClick={() => createVertexVideo.mutate()}
                disabled={!brief}
                loading={createVertexVideo.isPending}
              >
                Crear video
              </Button>
            }
          >
            {createVertexVideo.isPending && (
              <Space>
                <Spin />
                <Text>Vertex AI creando video…</Text>
              </Space>
            )}

            {operationName && (
              <div>
                <Text>
                  Operation:{" "}
                  <b style={{ wordBreak: "break-all" }}>{operationName}</b>
                </Text>
                <div style={{ marginTop: 6 }}>
                  {!videoDone ? (
                    <Space>
                      <Spin />
                      <Text>Generando… (poll cada 5s)</Text>
                    </Space>
                  ) : (
                    <Text>Listo ✅</Text>
                  )}
                </div>
              </div>
            )}

            {downloadUrl && (
              <div style={{ marginTop: 12 }}>
                <Button type="primary" href={downloadUrl} target="_blank">
                  Descargar MP4
                </Button>
              </div>
            )}

            {videoRaw?.raw?.error && (
              <Alert
                style={{ marginTop: 12 }}
                type="error"
                message="Error en Vertex/Veo"
                description={
                  <pre style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(videoRaw.raw.error, null, 2)}
                  </pre>
                }
              />
            )}
          </Card>
        </Space>
      )}
    </div>
  );
}
