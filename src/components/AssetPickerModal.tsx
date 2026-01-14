import { useMemo, useState } from "react";
import {
  Modal,
  List,
  Card,
  Image,
  Upload,
  Button,
  Input,
  Space,
  message,
  Typography,
} from "antd";
import type { UploadProps } from "antd";

import axios from "axios";
import { api } from "../lib/api";

const { Text } = Typography;

export type Asset = {
  id: number;
  type: "photo" | "video";
  url: string;
  tags: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId: number;
  assets: Asset[];
  onPick: (asset: Asset) => void;
  onAssetsRefresh: () => Promise<void>;
};

export default function AssetPickerModal({
  open,
  onClose,
  restaurantId,
  assets,
  onPick,
  onAssetsRefresh,
}: Props) {
  const uploaderUrl =
    import.meta.env.VITE_MEDIA_UPLOAD_API ||
    "http://localhost:8081/apienviosmultimedia";

  const [tags, setTags] = useState("terraza,cocteles,musica");
  const [uploading, setUploading] = useState(false);

  const photoAssets = useMemo(
    () => assets.filter((a) => a.type === "photo"),
    [assets]
  );

  const folderName = useMemo(() => {
    // carpeta por restaurante (puedes cambiar)
    return `restaurant_${restaurantId}`;
  }, [restaurantId]);

  const createAssetInDb = async (fileUrl: string) => {
    const tagsArr = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    await api.post(`/restaurants/${restaurantId}/assets`, {
      type: "photo",
      url: fileUrl,
      tags: tagsArr,
    });
  };

  const customUpload: UploadProps["customRequest"] = async (opts) => {
    const form = new FormData();
    form.append("folder", folderName);

    form.append("files[]", opts.file as any);

    setUploading(true);
    try {
      const res = await axios.post(uploaderUrl, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploaded = res.data?.files ?? [];
      if (!uploaded.length) {
        message.error("No se recibieron URLs del uploader PHP");
        return;
      }

      // guarda en Postgres (Adonis)
      for (const f of uploaded) {
        if (f?.url) {
          await createAssetInDb(f.url);
        }
      }

      message.success(
        `Subidos ${uploaded.length} archivo(s) y guardados en DB`
      );
      await onAssetsRefresh();
      opts.onSuccess?.(res.data);
    } catch (e: any) {
      message.error(
        e?.response?.data?.error || e?.message || "Error subiendo archivos"
      );
      opts.onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title="Selecciona o sube imágenes (Assets)"
      open={open}
      onCancel={onClose}
      footer={null}
      width={1000}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Card size="small" title="Subir nuevas imágenes">
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Text type="secondary">
              Se suben a tu API PHP y luego se registran en Postgres como
              Assets.
            </Text>

            <Space wrap style={{ width: "100%" }}>
              <div style={{ minWidth: 420 }}>
                <Text>Tags (se aplican a los archivos subidos):</Text>
                <Input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="terraza,cocteles,musica"
                />
              </div>

              <div>
                <Text>Carpeta destino:</Text>
                <Input value={folderName} disabled style={{ width: 220 }} />
              </div>

              <Upload
                multiple
                accept="image/*"
                showUploadList={false}
                customRequest={customUpload}
                disabled={uploading}
              >
                <Button type="primary" loading={uploading}>
                  Subir imágenes
                </Button>
              </Upload>
            </Space>
          </Space>
        </Card>

        <Card size="small" title={`Galería (${photoAssets.length})`}>
          <List
            grid={{ gutter: 12, column: 4 }}
            dataSource={photoAssets}
            renderItem={(a) => (
              <List.Item>
                <Card
                  hoverable
                  onClick={() => {
                    onPick(a);
                    onClose();
                  }}
                  cover={
                    <div style={{ padding: 8 }}>
                      <Image
                        src={a.url}
                        alt={`asset-${a.id}`}
                        style={{
                          width: "100%",
                          height: 160,
                          objectFit: "cover",
                          borderRadius: 8,
                        }}
                        preview={false}
                      />
                    </div>
                  }
                >
                  <div style={{ fontSize: 12, opacity: 0.85 }}>
                    <b>#{a.id}</b>
                    <div style={{ opacity: 0.75 }}>
                      {(a.tags ?? []).slice(0, 4).join(", ")}
                    </div>
                  </div>
                </Card>
              </List.Item>
            )}
          />
        </Card>
      </Space>
    </Modal>
  );
}
