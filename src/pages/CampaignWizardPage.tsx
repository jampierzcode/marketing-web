import { useMutation, useQuery } from "@tanstack/react-query";
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
import { Modal, List, Image, message } from "antd";
import { PictureOutlined, VideoCameraOutlined } from "@ant-design/icons";
import AssetPickerModal from "../components/AssetPickerModal";

const { Title, Text } = Typography;

type Asset = {
  id: number;
  type: "photo" | "video";
  url: string;
  tags: string[];
};

type SceneConfig = {
  sceneIndex: number;
  mode: "use_asset" | "ai_generate";
  assetId?: number;
  promptOverride?: string;
};

export default function CampaignWizardPage() {
  const { id } = useParams();
  const restaurantId = Number(id);

  const [requestId, setRequestId] = useState<number | null>(null);
  const [ideas, setIdeas] = useState<any[] | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const [brief, setBrief] = useState<any | null>(null);

  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetPickScene, setAssetPickScene] = useState<number | null>(null);
  const [pickedAssetIdByScene, setPickedAssetIdByScene] = useState<
    Record<number, number | null>
  >({});
  const [aiImageByScene, setAiImageByScene] = useState<
    Record<number, { id: number; url: string } | null>
  >({});
  const [clipByScene, setClipByScene] = useState<
    Record<number, { id: number; op: string; url?: string } | null>
  >({});
  const [promptOverrideByScene, setPromptOverrideByScene] = useState<
    Record<number, string>
  >({});
  const [globalBusy, setGlobalBusy] = useState(false);
  const [busySceneIndex, setBusySceneIndex] = useState<number | null>(null);

  // render results
  const [sceneConfigs, setSceneConfigs] = useState<SceneConfig[]>([]);
  const [renderScenes, setRenderScenes] = useState<any[] | null>(null);

  const assetsQ = useQuery({
    queryKey: ["assets", restaurantId],
    queryFn: async () =>
      (await api.get(`/restaurants/${restaurantId}/assets`)).data as Asset[],
    enabled: !!restaurantId,
  });
  const refreshAssets = async () => {
    await assetsQ.refetch();
  };

  const photoAssets = (assetsQ.data ?? []).filter((a) => a.type === "photo");

  const genSceneImage = useMutation({
    mutationFn: async (payload: {
      sceneIndex: number;
      mode: "text" | "asset_ref" | "prompt_only";
      assetId?: number;
      promptOverride?: string;
    }) => {
      const res = await api.post(
        `/campaign-requests/${requestId}/scenes/${payload.sceneIndex}/image`,
        {
          mode: payload.mode,
          assetId: payload.assetId,
          promptOverride: payload.promptOverride,
        }
      );
      return res.data as { aiAsset: { id: number; publicUrl: string } };
    },
  });

  const genSceneClip = useMutation({
    mutationFn: async (payload: {
      sceneIndex: number;
      mode: "from_asset" | "from_ai_image" | "text_only";
      assetId?: number;
      aiImageId?: number;
      promptOverride?: string;
    }) => {
      const res = await api.post(
        `/campaign-requests/${requestId}/scenes/${payload.sceneIndex}/clip`,
        {
          mode: payload.mode,
          assetId: payload.assetId,
          aiImageId: payload.aiImageId,
          promptOverride: payload.promptOverride,
        }
      );
      return res.data as { aiAssetId: number; operationName: string };
    },
  });
  useEffect(() => {
    if (!requestId) return;
    const interval = setInterval(async () => {
      const entries = Object.entries(clipByScene);
      for (const [k, clip] of entries) {
        if (!clip?.op || clip.url) continue;
        const sceneIndex = Number(k);
        try {
          const encoded = encodeURIComponent(clip.op);
          const res = await api.get(`/videos/veo-op/${encoded}`, {
            params: { aiAssetId: clip.id },
          });
          if (res.data.done && res.data.publicUrl) {
            setClipByScene((prev) => ({
              ...prev,
              [sceneIndex]: { ...prev[sceneIndex]!, url: res.data.publicUrl },
            }));
          }
        } catch {}
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [clipByScene, requestId]);

  const createReq = useMutation({
    mutationFn: async (payload: any) =>
      (await api.post("/campaign-requests", payload)).data as { id: number },
    onSuccess: (data) => {
      setRequestId(data.id);
      setIdeas(null);
      setSelectedIdeaId(null);
      setBrief(null);
      setSceneConfigs([]);
      setRenderScenes(null);
    },
  });

  const generateIdeas = useMutation({
    mutationFn: async () =>
      (await api.post(`/campaign-requests/${requestId}/ideas`)).data as any[],
    onSuccess: (data) => {
      setIdeas(data);
      setSelectedIdeaId(null);
      setBrief(null);
      setSceneConfigs([]);
      setRenderScenes(null);
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
      // default configs por escena: ai_generate
      const defaults: SceneConfig[] = (data.storyboard ?? []).map(
        (_: any, idx: number) => ({
          sceneIndex: idx,
          mode: "ai_generate",
        })
      );
      setSceneConfigs(defaults);
      setRenderScenes(null);
    },
  });

  const render = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/campaign-requests/${requestId}/render`, {
          scenes: sceneConfigs,
        })
      ).data,
    onSuccess: (data) => {
      const scenes = (data.scenes ?? []).map((s: any) => ({
        sceneIndex: s.sceneIndex,
        imageUrl: s.image?.publicUrl,
        clipOperationName: s.clip?.operationName,
        clipUrl: null,
        clipDone: false,
      }));
      setRenderScenes(scenes);
    },
  });

  // Poll clips per scene
  useEffect(() => {
    if (!renderScenes?.length) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;

      const next = [...renderScenes];
      let changed = false;

      for (const s of next) {
        if (!s.clipOperationName || s.clipDone) continue;

        try {
          const encoded = encodeURIComponent(s.clipOperationName);
          const res = await api.get(`/videos/veo-op/${encoded}`);
          if (res.data.done && res.data.publicUrl) {
            s.clipDone = true;
            s.clipUrl = res.data.publicUrl;
            changed = true;
          }
        } catch {
          // ignore
        }
      }

      if (changed) setRenderScenes(next);

      const stillRunning = next.some((x) => x.clipOperationName && !x.clipDone);
      if (stillRunning) setTimeout(tick, 5000);
    };

    tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderScenes?.map((x) => `${x.sceneIndex}:${x.clipDone}`).join("|")]);

  const currentStep = useMemo(() => {
    if (!requestId) return 0;
    if (!ideas) return 1;
    if (!selectedIdeaId) return 2;
    if (!brief) return 3;
    if (!renderScenes) return 4;
    return 5;
  }, [requestId, ideas, selectedIdeaId, brief, renderScenes]);

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
              { title: "Ideas" },
              { title: "Elegir idea" },
              { title: "Storyboard" },
              { title: "Scene Builder" },
              { title: "Imágenes + Clips" },
            ]}
          />

          <Card
            title="1) Ideas"
            extra={
              <Button
                type="primary"
                onClick={() => generateIdeas.mutate()}
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
                <Title level={5}>Storyboard</Title>
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
              </>
            )}
          </Card>

          {brief?.storyboard?.map((b: any, idx: number) => {
            const pickedAssetId = pickedAssetIdByScene[idx] ?? null;
            const pickedAsset =
              photoAssets.find((a) => a.id === pickedAssetId) ?? null;
            const aiImg = aiImageByScene[idx] ?? null;
            const clip = clipByScene[idx] ?? null;
            const promptOverride = promptOverrideByScene[idx] ?? "";

            const sceneBusy = globalBusy && busySceneIndex === idx;

            const onPickAsset = () => {
              setAssetPickScene(idx);
              setAssetModalOpen(true);
            };

            const runLocked = () => {
              message.warning(
                "Espera a que termine la acción actual (evitamos cuota)."
              );
            };

            return (
              <Card
                key={idx}
                type="inner"
                title={`Escena ${idx + 1}: ${b.tStart}s–${b.tEnd}s`}
                style={{ marginBottom: 10 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 0.9fr",
                    gap: 14,
                  }}
                >
                  {/* Columna izquierda: controles */}
                  <div>
                    <div style={{ marginBottom: 8 }}>
                      <b>OnScreen:</b> {b.onScreen}
                      <div style={{ opacity: 0.85 }}>{b.shot}</div>
                    </div>

                    <Space wrap>
                      <Button
                        onClick={() => {
                          setAssetPickScene(idx);
                          setAssetModalOpen(true);
                        }}
                      >
                        Elegir asset
                      </Button>

                      <Input
                        style={{ width: 420 }}
                        placeholder="Prompt extra (opcional)"
                        value={promptOverride}
                        onChange={(e) =>
                          setPromptOverrideByScene((p) => ({
                            ...p,
                            [idx]: e.target.value,
                          }))
                        }
                        disabled={globalBusy && !sceneBusy}
                      />
                    </Space>

                    <div style={{ marginTop: 12 }}>
                      <Space wrap>
                        {/* Generar imagen */}
                        <Button
                          type="primary"
                          icon={<PictureOutlined />}
                          loading={sceneBusy && genSceneImage.isPending}
                          disabled={globalBusy && !sceneBusy}
                          onClick={async () => {
                            if (globalBusy) return runLocked();
                            setGlobalBusy(true);
                            setBusySceneIndex(idx);
                            try {
                              // Si hay asset seleccionado => asset_ref, si no => text
                              const mode = pickedAssetId ? "asset_ref" : "text";
                              const out = await genSceneImage.mutateAsync({
                                sceneIndex: idx,
                                mode,
                                assetId: pickedAssetId || undefined,
                                promptOverride,
                              });
                              setAiImageByScene((p) => ({
                                ...p,
                                [idx]: {
                                  id: out.aiAsset.id,
                                  url: out.aiAsset.publicUrl,
                                },
                              }));
                              message.success(
                                `Imagen lista (escena ${idx + 1})`
                              );
                            } catch (e: any) {
                              message.error(
                                e?.response?.data?.message ||
                                  e?.message ||
                                  "Error generando imagen"
                              );
                            } finally {
                              setGlobalBusy(false);
                              setBusySceneIndex(null);
                            }
                          }}
                        >
                          Generar imagen IA
                        </Button>

                        {/* Generar clip */}
                        <Button
                          icon={<VideoCameraOutlined />}
                          loading={sceneBusy && genSceneClip.isPending}
                          disabled={globalBusy && !sceneBusy}
                          onClick={async () => {
                            if (globalBusy) return runLocked();
                            setGlobalBusy(true);
                            setBusySceneIndex(idx);
                            try {
                              // prioridad: si hay imagen IA => from_ai_image
                              // si no, si hay asset => from_asset
                              // si no, text_only
                              const mode = aiImg?.id
                                ? "from_ai_image"
                                : pickedAssetId
                                ? "from_asset"
                                : "text_only";

                              const out = await genSceneClip.mutateAsync({
                                sceneIndex: idx,
                                mode,
                                assetId: pickedAssetId || undefined,
                                aiImageId: aiImg?.id,
                                promptOverride,
                              });

                              setClipByScene((p) => ({
                                ...p,
                                [idx]: {
                                  id: out.aiAssetId,
                                  op: out.operationName,
                                },
                              }));
                              message.info(
                                `Clip iniciado (escena ${
                                  idx + 1
                                }). Poll cada 5s…`
                              );
                            } catch (e: any) {
                              message.error(
                                e?.response?.data?.message ||
                                  e?.message ||
                                  "Error iniciando clip"
                              );
                            } finally {
                              setGlobalBusy(false);
                              setBusySceneIndex(null);
                            }
                          }}
                        >
                          Generar clip
                        </Button>
                      </Space>
                    </div>

                    <div style={{ marginTop: 10, opacity: 0.8 }}>
                      <div>
                        <b>Asset seleccionado:</b>{" "}
                        {pickedAsset ? `#${pickedAsset.id}` : "(ninguno)"}
                      </div>
                      <div>
                        <b>Imagen IA:</b>{" "}
                        {aiImg ? `#${aiImg.id}` : "(no generada)"}
                      </div>
                      <div>
                        <b>Clip:</b>{" "}
                        {clip
                          ? clip.url
                            ? "listo ✅"
                            : "generando…"
                          : "(no iniciado)"}
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha: preview */}
                  <div>
                    <Card
                      size="small"
                      title="Preview"
                      style={{ marginBottom: 10 }}
                    >
                      <div style={{ marginBottom: 10 }}>
                        <b>Imagen</b>
                        <div style={{ marginTop: 6 }}>
                          {aiImg?.url || pickedAsset?.url ? (
                            <>
                              <Image
                                src={aiImg?.url || pickedAsset?.url}
                                style={{ borderRadius: 8 }}
                              />
                              <div style={{ marginTop: 8 }}>
                                <Button
                                  href={aiImg?.url || pickedAsset?.url}
                                  target="_blank"
                                >
                                  Descargar imagen
                                </Button>
                              </div>
                            </>
                          ) : (
                            <Text type="secondary">Sin imagen aún.</Text>
                          )}
                        </div>
                      </div>

                      <div>
                        <b>Clip</b>
                        <div style={{ marginTop: 6 }}>
                          {clip?.url ? (
                            <>
                              <video
                                src={clip.url}
                                controls
                                style={{ width: "100%", borderRadius: 8 }}
                              />
                              <div style={{ marginTop: 8 }}>
                                <Button
                                  type="primary"
                                  href={clip.url}
                                  target="_blank"
                                >
                                  Descargar clip
                                </Button>
                              </div>
                            </>
                          ) : (
                            <Text type="secondary">
                              {clip?.op
                                ? "Generando clip… (poll 5s)"
                                : "Sin clip aún."}
                            </Text>
                          )}
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              </Card>
            );
          })}

          <AssetPickerModal
            open={assetModalOpen}
            onClose={() => setAssetModalOpen(false)}
            restaurantId={restaurantId}
            assets={assetsQ.data ?? []}
            onAssetsRefresh={refreshAssets}
            onPick={(asset) => {
              if (assetPickScene == null) return;
              // aquí guardas el asset seleccionado en tu estado por escena
              setPickedAssetIdByScene((prev) => ({
                ...prev,
                [assetPickScene]: asset.id,
              }));
            }}
          />
        </Space>
      )}
    </div>
  );
}
